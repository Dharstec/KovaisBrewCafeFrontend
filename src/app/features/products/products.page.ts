import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductApi } from '../../core/api/product.api';
import { AuthApi } from '../../core/api/auth.api';
import { StockApi } from '../../core/api/stock.api';

interface WizardIngredient {
  /** existing stock item id, or null if user is creating a new one */
  stock_item_id: number | null;
  used_qty: number | null;
  /** when null id is used, fields below describe the new stock item to create */
  new_name: string;
  new_base_unit: 'gm' | 'ml' | 'pcs' | string;
  new_unit_label: string;
  new_unit_value: number;
  new_min_qty: number;
  /** populated after createStockItem succeeds (so retry on Finish doesn't recreate) */
  created_id?: number | null;
}

interface WizardPurchase {
  /** which ingredient this purchase is for (index in ingredients array) */
  ingredient_index: number;
  qty: number | null;           // total qty (primary, required)
  showBreakdown: boolean;       // optional pack breakdown
  packs: number | null;         // optional
  qty_per_pack: number | null;  // optional
  purchase_price: number | null;
  expiry_date: string;
  supplier: string;
  batch_no: string;
  notes: string;
  saved?: boolean;
}

@Component({
  standalone: true,
  selector: 'app-products-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss']
})
export class ProductsPage implements OnInit {

  private stockApi = inject(StockApi);

  products: any[] = [];
  categories: any[] = [];
  stockProducts: any[] = [];
  recipeItems: any[] = [];

  search = '';
  selectedCategory = '';
  page = 1;
  limit = 10;

  /* ── legacy edit modal state (kept for editing existing products) ── */
  show = false;
  saving = false;
  saveError = '';

  form: any = {};

  /* ── new product wizard state ── */
  wizardOpen = false;
  wizardStep: 1 | 2 | 3 | 4 = 1;
  wizardSaving = false;
  wizardError = '';
  wizardProductId: number | null = null;   // becomes set after Step 1 commits
  wizardForm: any = this.blankWizardForm();
  wizardIngredients: WizardIngredient[] = [];
  wizardPurchases: WizardPurchase[] = [];

  totalPages = 1;
  pages: number[] = [];

  isAdmin = false;

  /* ── add-on management (edit modal) ── */
  addons: any[] = [];
  addonForm = { name: '', price: null as number | null, platform: 'both' };
  addonSaving = false;
  addonError  = '';

  constructor(private productApi: ProductApi, private authApi: AuthApi) { }

  ngOnInit() {
    this.isAdmin = this.authApi.isAdmin();
    this.loadProducts();
    this.loadCategories();
  }

  loadProducts() {
    this.productApi.getAll(
      this.search,
      this.page,
      this.limit,
      this.selectedCategory
    ).subscribe({
      next: (res: any) => {
        this.products   = res?.data || [];
        this.totalPages = res?.totalPages || 1;
        this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
      },
      error: () => { this.products = []; }
    });
  }

  loadCategories() {
    this.productApi.getAllCategories().subscribe({
      next: (r: any) => { this.categories = r?.data || []; },
      error: () => {}
    });
  }

  loadStockProducts() {
    this.productApi.getStockDropDownItems().subscribe((r: any[]) => this.stockProducts = r);
  }

  /** Legacy modal — used only by edit() now. New product creation goes via the wizard. */
  open() {
    this.form = {
      name: '',
      price: 0,
      zomato_price: null,
      swiggy_price: null,
      zomato_packing: null,
      swiggy_packing: null,
      category_id: null,
      image_url: '',
      stock_item_id: null,
      stock_mode: 'none',
      is_sellable: true,
      is_manual_price: false,
      is_active: true
    };
    this.recipeItems = [];
    this.saveError = '';
    this.loadStockProducts();
    this.show = true;
  }

  /* ════════════════════════════════════════════════
     PRODUCT CREATION WIZARD (4 steps)
     1) Product details
     2) Stock tracking mode
     3) Stock item / Ingredients
     4) Initial purchase (optional)
     ════════════════════════════════════════════════ */
  private blankWizardForm() {
    return {
      name: '',
      category_id: null as number | null,
      image_url: '',
      is_sellable: true,
      is_manual_price: false,
      price: null as number | null,
      zomato_price:   null as number | null,
      swiggy_price:   null as number | null,
      zomato_packing: null as number | null,
      swiggy_packing: null as number | null,
      stock_mode: 'recipe' as 'none' | 'direct' | 'recipe',
      is_active: true
    };
  }

  private blankIngredient(): WizardIngredient {
    return {
      stock_item_id: null,
      used_qty: 1,
      new_name: '',
      new_base_unit: 'pcs',
      new_unit_label: 'pcs',  // kept identical to base_unit so packs × qty/pack stays consistent
      new_unit_value: 1,      // 1 = no internal unit conversion; pack count comes from the purchase
      new_min_qty: 0,
      created_id: null
    };
  }

  openWizard() {
    this.wizardOpen      = true;
    this.wizardStep      = 1;
    this.wizardSaving    = false;
    this.wizardError     = '';
    this.wizardProductId = null;
    this.wizardForm      = this.blankWizardForm();
    this.wizardIngredients = [this.blankIngredient()];
    this.wizardPurchases = [];
    this.loadStockProducts();
  }

  closeWizard() {
    this.wizardOpen = false;
    this.wizardSaving = false;
    this.wizardError = '';
  }

  /* ── step nav ── */
  goNext() {
    const v = this.validateStep();
    if (v) { this.wizardError = v; return; }
    this.wizardError = '';
    if (this.wizardStep === 4) { this.finishWizard(); return; }
    this.wizardStep = (this.wizardStep + 1) as 1 | 2 | 3 | 4;
    // When entering step 4, seed purchase rows from ingredients (one per ingredient)
    if (this.wizardStep === 4) this.seedPurchases();
  }

  goBack() {
    if (this.wizardStep === 1) return;
    this.wizardError = '';
    this.wizardStep = (this.wizardStep - 1) as 1 | 2 | 3 | 4;
  }

  private validateStep(): string {
    const f = this.wizardForm;
    if (this.wizardStep === 1) {
      if (!f.name?.trim())                                            return 'Product name is required';
      if (!f.category_id)                                             return 'Please select a category';
      if (f.is_sellable && !f.is_manual_price && !(f.price > 0))      return 'Price must be greater than 0';
    }
    if (this.wizardStep === 2) {
      if (!['none', 'direct', 'recipe'].includes(f.stock_mode))       return 'Choose a stock tracking mode';
    }
    if (this.wizardStep === 3) {
      if (f.stock_mode === 'direct') {
        const ing = this.wizardIngredients[0];
        if (!ing) return 'Add a stock item';
        if (!ing.stock_item_id && !ing.new_name?.trim())              return 'Pick an existing stock item or enter a name to create one';
      }
      if (f.stock_mode === 'recipe') {
        if (!this.wizardIngredients.length)                           return 'Add at least one ingredient';
        for (let i = 0; i < this.wizardIngredients.length; i++) {
          const r = this.wizardIngredients[i];
          if (!r.stock_item_id && !r.new_name?.trim())                return `Ingredient ${i + 1}: pick an item or enter a name`;
          if (!r.used_qty || r.used_qty <= 0)                         return `Ingredient ${i + 1}: enter qty per sale`;
        }
      }
    }
    if (this.wizardStep === 4) {
      // Purchases are optional. If a row has qty or price, require both.
      for (let i = 0; i < this.wizardPurchases.length; i++) {
        const p = this.wizardPurchases[i];
        const touched = p.qty || p.purchase_price;
        if (!touched) continue;
        if (!p.qty || p.qty <= 0)                              return `Purchase ${i + 1}: enter quantity`;
        if (p.purchase_price == null || p.purchase_price < 0)  return `Purchase ${i + 1}: enter price`;
        if (p.showBreakdown) {
          if (!p.packs || p.packs <= 0)                        return `Purchase ${i + 1}: enter number of packs`;
          if (!p.qty_per_pack || p.qty_per_pack <= 0)          return `Purchase ${i + 1}: enter qty per pack`;
        }
      }
    }
    return '';
  }

  /* ── step 2 helpers ── */
  setWizardMode(m: 'none' | 'direct' | 'recipe') {
    this.wizardForm.stock_mode = m;
    if (m === 'none') {
      this.wizardIngredients = [];
    } else if (m === 'direct') {
      this.wizardIngredients = [this.blankIngredient()];
    } else {
      if (!this.wizardIngredients.length) this.wizardIngredients = [this.blankIngredient()];
    }
  }

  /* ── step 3 helpers ── */
  addIngredient() { this.wizardIngredients.push(this.blankIngredient()); }
  removeIngredient(i: number) {
    if (this.wizardIngredients.length <= 1) return;
    this.wizardIngredients.splice(i, 1);
  }

  /* When the user picks an existing item, clear the "create new" fields. */
  onIngredientSelect(ing: WizardIngredient) {
    if (ing.stock_item_id) {
      ing.new_name = '';
    }
  }
  /* Inverse: typing a name clears any existing selection. */
  onNewNameChange(ing: WizardIngredient) {
    if (ing.new_name?.trim()) {
      ing.stock_item_id = null;
    }
  }

  /* ── step 4 helpers ── */
  private seedPurchases() {
    if (this.wizardForm.stock_mode === 'none') {
      this.wizardPurchases = [];
      return;
    }
    // One purchase row per unique ingredient (preserve old rows if re-entering step 4)
    const newRows: WizardPurchase[] = this.wizardIngredients.map((_, idx) => {
      const existing = this.wizardPurchases[idx];
      return existing || {
        ingredient_index: idx,
        qty: null, showBreakdown: false, packs: null, qty_per_pack: null,
        purchase_price: null, expiry_date: '', supplier: '', batch_no: '', notes: '',
        saved: false
      };
    });
    this.wizardPurchases = newRows;
  }

  recomputePurchaseQty(p: WizardPurchase) {
    const packs   = Number(p.packs);
    const perPack = Number(p.qty_per_pack);
    if (packs > 0 && perPack > 0) {
      p.qty = Math.round(packs * perPack * 1000) / 1000;
    }
  }

  togglePurchaseBreakdown(p: WizardPurchase) {
    p.showBreakdown = !p.showBreakdown;
    if (!p.showBreakdown) { p.packs = null; p.qty_per_pack = null; }
  }

  ingredientLabel(i: number): string {
    const ing = this.wizardIngredients[i];
    if (!ing) return '';
    if (ing.stock_item_id) {
      const found = this.stockProducts.find(s => Number(s.id) === Number(ing.stock_item_id));
      return found?.name || `Item #${ing.stock_item_id}`;
    }
    return ing.new_name?.trim() || `New item ${i + 1}`;
  }

  ingredientUnitLabel(i: number): string {
    const ing = this.wizardIngredients[i];
    if (!ing) return '';
    if (ing.stock_item_id) {
      const found = this.stockProducts.find(s => Number(s.id) === Number(ing.stock_item_id));
      return found?.unit_label || found?.base_unit || '';
    }
    return ing.new_unit_label || ing.new_base_unit || '';
  }

  /* ── final commit ── */
  async finishWizard() {
    if (this.wizardSaving) return;
    this.wizardSaving = true;
    this.wizardError  = '';

    try {
      // 1) Create the product (idempotent — skip if already created on a prior retry)
      if (!this.wizardProductId) {
        const p = await this.createProductFromWizard();
        this.wizardProductId = p;
      }

      // 2) For ingredients with no stock_item_id, create the stock item now.
      for (const ing of this.wizardIngredients) {
        if (!ing.stock_item_id && !ing.created_id && ing.new_name?.trim()) {
          const created = await this.createStockItemFromWizard(ing);
          ing.created_id = created;
          ing.stock_item_id = created;
        } else if (ing.created_id && !ing.stock_item_id) {
          ing.stock_item_id = ing.created_id;
        }
      }

      // 3) Wire the product to the stock items based on mode.
      const mode = this.wizardForm.stock_mode;
      if (mode === 'direct') {
        const ing = this.wizardIngredients[0];
        await this.updateProductStockItem(this.wizardProductId!, ing.stock_item_id);
        await this.saveProductRecipe(this.wizardProductId!, []);  // ensure no stale recipe
      } else if (mode === 'recipe') {
        await this.updateProductStockItem(this.wizardProductId!, null);
        await this.saveProductRecipe(
          this.wizardProductId!,
          this.wizardIngredients.map(ing => ({
            stock_item_id: ing.stock_item_id!,
            used_qty: Number(ing.used_qty)
          }))
        );
      } else {
        // none: clear any link
        await this.updateProductStockItem(this.wizardProductId!, null);
        await this.saveProductRecipe(this.wizardProductId!, []);
      }

      // 4) Save initial purchases (skip already-saved + skip empty rows).
      for (const purchase of this.wizardPurchases) {
        if (purchase.saved) continue;
        if (!purchase.qty || purchase.qty <= 0) continue;
        if (purchase.purchase_price == null || purchase.purchase_price < 0) continue;
        const ing = this.wizardIngredients[purchase.ingredient_index];
        if (!ing?.stock_item_id) continue;
        await this.saveInitialPurchase(ing.stock_item_id, purchase);
        purchase.saved = true;
      }

      // Done
      this.wizardSaving = false;
      this.closeWizard();
      this.loadProducts();
    } catch (err: any) {
      this.wizardSaving = false;
      this.wizardError = err?.error?.msg || err?.error?.message || err?.message || 'Save failed — fix the issue and click Finish again';
    }
  }

  private createProductFromWizard(): Promise<number> {
    const f = this.wizardForm;
    const payload: any = {
      name: f.name.trim(),
      category_id: f.category_id,
      price: f.is_manual_price ? 0 : Number(f.price) || 0,
      zomato_price:   f.zomato_price   != null ? Number(f.zomato_price)   : null,
      swiggy_price:   f.swiggy_price   != null ? Number(f.swiggy_price)   : null,
      zomato_packing: f.zomato_packing != null ? Number(f.zomato_packing) : null,
      swiggy_packing: f.swiggy_packing != null ? Number(f.swiggy_packing) : null,
      image_url: f.image_url || '',
      is_sellable: !!f.is_sellable,
      is_manual_price: !!f.is_manual_price,
      is_active: true
    };
    return new Promise<number>((resolve, reject) => {
      this.productApi.productCreate(payload).subscribe({
        next: (res: any) => {
          const id = res?.product?.id || res?.id;
          if (!id) return reject({ message: 'Product create returned no id' });
          resolve(Number(id));
        },
        error: reject
      });
    });
  }

  private createStockItemFromWizard(ing: WizardIngredient): Promise<number> {
    // Force unit_label = base_unit and unit_value = 1 so the per-purchase
    // "packs × qty/pack" math is the source of truth (no double-conversion).
    const unit = ing.new_base_unit || 'pcs';
    const payload = {
      name:        ing.new_name.trim(),
      category_id: null,
      base_unit:   unit,
      unit_label:  unit,
      unit_value:  1,
      min_qty:     Number(ing.new_min_qty) || 0
    };
    return new Promise<number>((resolve, reject) => {
      this.stockApi.createStockItem(payload).subscribe({
        next: (res: any) => {
          const id = res?.item?.id || res?.id || res?.data?.id;
          if (!id) return reject({ message: `Stock item create returned no id for ${ing.new_name}` });
          resolve(Number(id));
        },
        error: reject
      });
    });
  }

  private updateProductStockItem(productId: number, stockItemId: number | null): Promise<void> {
    const f = this.wizardForm;
    const payload = {
      name: f.name.trim(),
      category_id: f.category_id,
      price: f.is_manual_price ? 0 : Number(f.price) || 0,
      zomato_price:   f.zomato_price   != null ? Number(f.zomato_price)   : null,
      swiggy_price:   f.swiggy_price   != null ? Number(f.swiggy_price)   : null,
      zomato_packing: f.zomato_packing != null ? Number(f.zomato_packing) : null,
      swiggy_packing: f.swiggy_packing != null ? Number(f.swiggy_packing) : null,
      image_url: f.image_url || '',
      is_sellable: !!f.is_sellable,
      is_manual_price: !!f.is_manual_price,
      is_active: true,
      stock_item_id: stockItemId
    };
    return new Promise<void>((resolve, reject) => {
      this.productApi.productUpdate(productId, payload).subscribe({
        next: () => resolve(),
        error: reject
      });
    });
  }

  private saveProductRecipe(productId: number, items: { stock_item_id: number; used_qty: number }[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.productApi.saveRecipe({ sale_product_id: productId, items }).subscribe({
        next: () => resolve(),
        error: reject
      });
    });
  }

  private saveInitialPurchase(stockItemId: number, p: WizardPurchase): Promise<void> {
    const breakdown = (p.showBreakdown && p.packs && p.qty_per_pack)
      ? `${p.packs} × ${p.qty_per_pack} packs`
      : null;
    const baseNotes  = (p.notes || '').trim();
    const finalNotes = breakdown
      ? (baseNotes ? `${baseNotes} (${breakdown})` : breakdown)
      : (baseNotes || undefined);

    const payload: any = {
      stock_item_id:  stockItemId,
      purchase_date:  new Date().toISOString().split('T')[0],
      supplier:       p.supplier || undefined,
      qty:            Number(p.qty),
      purchase_price: Number(p.purchase_price),
      expiry_date:    p.expiry_date || undefined,
      batch_no:       p.batch_no    || undefined,
      notes:          finalNotes
    };
    return new Promise<void>((resolve, reject) => {
      this.stockApi.addEntry(payload).subscribe({
        next: () => resolve(),
        error: reject
      });
    });
  }

  close() {
    this.show = false;
    this.saving = false;
    this.saveError = '';
    this.addons = [];
    this.addonError = '';
  }

  loadAddons(productId: number) {
    this.productApi.getAddons(productId).subscribe({
      next: (res) => { this.addons = res; },
      error: () => { this.addons = []; }
    });
  }

  addAddon() {
    if (!this.form.id) return;
    if (!this.addonForm.name?.trim()) { this.addonError = 'Name is required'; return; }
    if (this.addonForm.price == null || this.addonForm.price < 0) { this.addonError = 'Price must be ≥ 0'; return; }
    this.addonSaving = true;
    this.addonError  = '';
    this.productApi.createAddon(this.form.id, {
      name:     this.addonForm.name.trim(),
      price:    Number(this.addonForm.price),
      platform: this.addonForm.platform
    }).subscribe({
      next: () => {
        this.addonForm = { name: '', price: null, platform: 'both' };
        this.addonSaving = false;
        this.loadAddons(this.form.id);
      },
      error: (err) => {
        this.addonSaving = false;
        this.addonError  = err.error?.message || 'Failed to save add-on';
      }
    });
  }

  removeAddon(addonId: number) {
    if (!confirm('Delete this add-on?')) return;
    this.productApi.deleteAddon(addonId).subscribe({
      next: () => this.loadAddons(this.form.id),
      error: () => alert('Failed to delete add-on')
    });
  }

  edit(p: any) {
    this.loadStockProducts();
    this.saveError = '';
    this.addons    = [];
    this.addonForm = { name: '', price: null, platform: 'both' };
    this.addonError = '';

    const isSellable    = p.is_sellable    === true || p.is_sellable    === 'true';
    const isManualPrice = p.is_manual_price === true || p.is_manual_price === 'true';
    const hasRecipe     = Number(p.recipe_count) > 0;
    const stockMode     = hasRecipe ? 'recipe' : (p.stock_item_id ? 'direct' : 'none');

    this.form = {
      ...p,
      category_id:     p.category_id     ? Number(p.category_id)     : null,
      stock_item_id:   p.stock_item_id   ? Number(p.stock_item_id)   : null,
      zomato_price:    p.zomato_price    != null ? Number(p.zomato_price)    : null,
      swiggy_price:    p.swiggy_price    != null ? Number(p.swiggy_price)    : null,
      zomato_packing:  p.zomato_packing  != null ? Number(p.zomato_packing)  : null,
      swiggy_packing:  p.swiggy_packing  != null ? Number(p.swiggy_packing)  : null,
      is_sellable:     isSellable,
      is_manual_price: isManualPrice,
      stock_mode:      stockMode
    };

    this.recipeItems = [];
    if (isSellable && hasRecipe) {
      this.productApi.getRecipeByProduct(p.id).subscribe({
        next: (res: any) => {
          const items = Array.isArray(res) ? res : (res?.data || []);
          this.recipeItems = items.map((r: any) => ({
            stock_item_id: r.stock_item_id ? Number(r.stock_item_id) : null,
            used_qty: r.used_qty
          }));
        },
        error: () => { this.recipeItems = []; }
      });
    }

    this.loadAddons(p.id);
    this.show = true;
  }

  setStockMode(mode: 'none' | 'direct' | 'recipe') {
    this.form.stock_mode = mode;
    if (mode !== 'direct')  this.form.stock_item_id = null;
    if (mode !== 'recipe')  this.recipeItems = [];
  }

  addRecipe() {
    this.recipeItems.push({ stock_item_id: null, used_qty: 1 });
  }

  removeRecipe(i: number) {
    this.recipeItems.splice(i, 1);
  }

  save() {
    if (!this.form.name?.trim())    { this.saveError = 'Product name is required'; return; }
    if (!this.form.category_id)     { this.saveError = 'Please select a category'; return; }
    if (this.form.is_sellable && !this.form.is_manual_price && !(this.form.price > 0)) {
      this.saveError = 'Price must be greater than 0'; return;
    }
    if (this.saving) return;

    this.saveError = '';
    this.saving = true;

    const { stock_mode, ...formData } = this.form;
    const payload = { ...formData };
    const req = this.form.id
      ? this.productApi.productUpdate(this.form.id, payload)
      : this.productApi.productCreate(payload);

    req.subscribe({
      next: (res: any) => {
        const productId = this.form.id || res?.product?.id || res?.id;
        const shouldSaveRecipe = productId && this.form.is_sellable;

        if (shouldSaveRecipe) {
          /* Always call saveRecipe — sends empty array to clear when switching away from recipe mode */
          this.productApi.saveRecipe({
            sale_product_id: productId,
            items: this.form.stock_mode === 'recipe' ? this.recipeItems : []
          }).subscribe({
            next: () => { this.close(); this.loadProducts(); },
            error: (err: any) => {
              this.saving = false;
              this.saveError = err.error?.msg || err.error?.message || 'Failed to save recipe';
            }
          });
        } else {
          this.close();
          this.loadProducts();
        }
      },
      error: (err: any) => {
        this.saving = false;
        this.saveError = err.error?.msg || err.error?.message || 'Failed to save product';
      }
    });
  }

  remove(id: number) {
    if (!confirm('Delete product?')) return;
    this.productApi.productDelete(id)
      .subscribe(() => this.loadProducts());
  }

onSearchChange() {
  this.page = 1;
  this.loadProducts();
}

onCategoryChange() {
  this.page = 1;
  this.loadProducts();
}
changePage(p: number) {
  if (p < 1 || p > this.totalPages) return;
  this.page = p;
  this.loadProducts();
}


}
