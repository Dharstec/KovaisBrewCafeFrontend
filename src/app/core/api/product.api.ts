import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProductApi {

  private http = inject(HttpClient);
  getAllBilling() {
    return this.http.get<any[]>(`${environment.apiUrl}/products_billing`);
  }
  getAll(
    search = '',
    page = 1,
    limit = 8,
    category_id = ''
  ) {
    return this.http.get<any>(
      `${environment.apiUrl}/products`,
      {
        params: {
          search,
          page,
          limit,
          ...(category_id && { category_id })
        }
      }
    );
  }


  productCreate(body: any) {
    return this.http.post<any[]>(`${environment.apiUrl}/products`, body);
  }
  productUpdate(id: number, body: any) {
    return this.http.put<any[]>(`${environment.apiUrl}/products/${id}`, body);
  }
  productDelete(id: number) {
    return this.http.delete<any[]>(`${environment.apiUrl}/products/${id}`);
  }

  getAllCategories() {
    return this.http.get<any[]>(`${environment.apiUrl}/category`);
  }
  getAllCategoriesBilling() {
    return this.http.get<any[]>(`${environment.apiUrl}/category_billing`);
  }

  getStockItems() {
    return this.http.get<any[]>(`${environment.apiUrl}/stock`);
  }

  getStockDropDownItems() {
    return this.http.get<any[]>(`${environment.apiUrl}/stock_dropdown`);
  }
  getRecipeByProduct(id: number) {
    return this.http.get<any[]>(`${environment.apiUrl}/recipes/${id}`);
  }

  saveRecipe(payload: any) {
    return this.http.post(`${environment.apiUrl}/recipes`, payload);
  }

}
