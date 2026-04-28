import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductApi } from '../../core/api/product.api';
import { SettingsApi } from '../../core/api/settings.api';
import { AuthApi } from '../../core/api/auth.api';

@Component({
  standalone: true,
  selector: 'app-products-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss']
})
export class ProductsPage implements OnInit {

  products: any[] = [];
  categories: any[] = [];
  stockProducts: any[] = [];
  recipeItems: any[] = [];

  search = '';
  selectedCategory = '';
  page = 1;
  limit = 10;

  show = false;
  saving = false;
  saveError = '';

  form: any = {};

  totalPages = 1;
  pages: number[] = [];

  isAdmin = false;

  /* ── Global packing defaults ── */
  globalSettings = { zomato_packing_default: '0', swiggy_packing_default: '0' };
  settingsSaving = false;
  settingsMsg = '';

  constructor(private productApi: ProductApi, private settingsApi: SettingsApi, private authApi: AuthApi) { }

  ngOnInit() {
    this.isAdmin = this.authApi.isAdmin();
    this.loadProducts();
    this.loadCategories();
    this.loadSettings();
  }

  loadSettings() {
    this.settingsApi.get().subscribe({
      next: s => this.globalSettings = { ...this.globalSettings, ...s }
    });
  }

  saveSettings() {
    this.settingsSaving = true;
    this.settingsApi.update(this.globalSettings).subscribe({
      next: () => {
        this.settingsSaving = false;
        this.settingsMsg = 'Saved!';
        setTimeout(() => this.settingsMsg = '', 2000);
      },
      error: () => { this.settingsSaving = false; this.settingsMsg = 'Failed'; }
    });
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

  close() {
    this.show = false;
    this.saving = false;
    this.saveError = '';
  }

  edit(p: any) {
    this.loadStockProducts();
    this.saveError = '';

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
