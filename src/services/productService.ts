import db from '../db/knex';
import { Product } from '../types';

// Helper function to convert database fields to frontend format
const mapProductToFrontend = (product: any): Product => {
  if (!product) return product;
  
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: parseFloat(product.price),
    cost: parseFloat(product.cost),
    stock: product.stock,
    lowStockThreshold: product.low_stock_threshold,
    barcode: product.barcode,
    description: product.description,
    created_at: product.created_at,
    updated_at: product.updated_at
  };
};

// Fetches all products
export const findAllProducts = async (): Promise<Product[]> => {
  const products = await db('products').select('*');
  return products.map(mapProductToFrontend);
};

// Fetches a single product by its ID
export const findProductById = async (id: string): Promise<Product | undefined> => {
  const product = await db('products').where({ id }).first();
  return product ? mapProductToFrontend(product) : undefined;
};

// Creates a new product
export const createProduct = async (productData: any): Promise<Product> => {
  const [newProduct] = await db('products').insert(productData).returning('*');
  return mapProductToFrontend(newProduct);
};

// Updates an existing product
export const updateProduct = async (id: string, productData: any): Promise<Product | undefined> => {
  const [updatedProduct] = await db('products')
    .where({ id })
    .update({ ...productData, updated_at: new Date() })
    .returning('*');
  return updatedProduct ? mapProductToFrontend(updatedProduct) : undefined;
};

// Deletes a product by its ID
export const deleteProduct = async (id: string): Promise<number> => {
  return db('products').where({ id }).del();
};