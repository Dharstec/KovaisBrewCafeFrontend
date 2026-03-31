import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductApi } from '../../core/api/product.api';

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

  form: any = {};

  totalPages = 1;
  pages: number[] = [];


  constructor(private productApi: ProductApi) { }

  ngOnInit() {
    this.loadProducts();
    this.loadCategories();
  }

  loadProducts() {
    this.productApi.getAll(
      this.search,
      this.page,
      this.limit,
      this.selectedCategory
    ).subscribe((res: any) => {
      this.products = res.data;
      this.totalPages = res.totalPages;

      this.pages = Array.from(
        { length: this.totalPages },
        (_, i) => i + 1
      );
    });
  }


  loadCategories() {
    this.productApi.getAllCategories()
      .subscribe((r: any) => this.categories = r.data);
  }

  loadStockProducts() {
    this.productApi.getStockDropDownItems().subscribe((r: any[]) => this.stockProducts = r);
  }

  open() {
    this.form = {
      name: '',
      price: 0,
      category_id: '',
      image_url: '',
      is_sellable: true,
      is_manual_price: false,
      is_active: true
    };
    this.recipeItems = [];
    this.loadStockProducts();
    this.show = true;
  }

  close() {
    this.show = false;
  }

  edit(p: any) {
    this.loadStockProducts();

    this.form = {
      ...p,
      is_sellable: p.is_sellable === true || p.is_sellable === 'true'
    };

    this.recipeItems = [];
    if (this.form.is_sellable) {
      this.productApi.getRecipeByProduct(p.id).subscribe((res: any) => {
        const items = Array.isArray(res) ? res : res?.data;
        this.recipeItems = (items || []).map((r: any) => ({
          stock_item_id: r.stock_item_id,
          used_qty: r.used_qty
        }));
      });
    }

    this.show = true;
  }

  addRecipe() {
    this.recipeItems.push({ stock_item_id: '', used_qty: 1 });
  }

  removeRecipe(i: number) {
    this.recipeItems.splice(i, 1);
  }

  save() {
    const payload = { ...this.form };

    const req = this.form.id
      ? this.productApi.productUpdate(this.form.id, payload)
      : this.productApi.productCreate(payload);

    req.subscribe((res: any) => {
      const productId = this.form.id || res?.product?.id || res?.id;

      if (productId && this.form.is_sellable) {
        this.productApi.saveRecipe({
          sale_product_id: productId,
          items: this.recipeItems
        }).subscribe(() => {
          this.close();
          this.loadProducts();
        });
      } else {
        this.close();
        this.loadProducts();
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
