/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
import type { Knex } from "knex";

exports.seed = async function(knex: Knex) {
  // Deletes ALL existing entries in reverse order of creation to respect foreign keys
  await knex('receipt_items').del();
  await knex('session_items').del();
  await knex('receipts').del();
  await knex('sessions').del();
  await knex('consoles').del();
  await knex('products').del();

  // Inserts console data
  await knex('consoles').insert([
    { id: 'ps4-1', name: 'PS4 Console 1', type: 'PS4', status: 'available', hourly_rate: 8 },
    { id: 'ps4-2', name: 'PS4 Console 2', type: 'PS4', status: 'available', hourly_rate: 8 },
    { id: 'ps4-3', name: 'PS4 Console 3', type: 'PS4', status: 'available', hourly_rate: 8 },
    { id: 'ps4-4', name: 'PS4 Console 4', type: 'PS4', status: 'available', hourly_rate: 8 },
    { id: 'ps5-1', name: 'PS5 Console 1', type: 'PS5', status: 'available', hourly_rate: 12 },
    { id: 'ps5-2', name: 'PS5 Console 2', type: 'PS5', status: 'available', hourly_rate: 12 },
  ]);

  // Inserts product data
  await knex('products').insert([
    { id: 'prod-1', name: 'Coca-Cola', category: 'drinks', price: 2.5, cost: 1.2, stock: 45, low_stock_threshold: 20, barcode: '049000050103' },
    { id: 'prod-2', name: 'Mountain Dew', category: 'drinks', price: 2.5, cost: 1.2, stock: 38, low_stock_threshold: 20, barcode: null },
    { id: 'prod-3', name: 'Red Bull', category: 'drinks', price: 4.0, cost: 2.5, stock: 15, low_stock_threshold: 20, barcode: null },
    { id: 'prod-4', name: 'Bottled Water', category: 'drinks', price: 1.5, cost: 0.5, stock: 60, low_stock_threshold: 30, barcode: null },
    { id: 'prod-5', name: 'Doritos', category: 'snacks', price: 3.0, cost: 1.5, stock: 28, low_stock_threshold: 15, barcode: null },
    { id: 'prod-6', name: 'Pringles', category: 'snacks', price: 3.5, cost: 1.8, stock: 22, low_stock_threshold: 15, barcode: null },
    { id: 'prod-7', name: 'Candy Bar', category: 'snacks', price: 2.0, cost: 0.9, stock: 42, low_stock_threshold: 25, barcode: null },
    { id: 'prod-8', name: 'Controller Skin', category: 'accessories', price: 12.0, cost: 6.0, stock: 8, low_stock_threshold: 10, barcode: null },
    { id: 'prod-9', name: 'HDMI Cable', category: 'accessories', price: 15.0, cost: 7.0, stock: 5, low_stock_threshold: 5, barcode: null },
    { id: 'prod-10', name: 'Gaming Headset', category: 'accessories', price: 45.0, cost: 25.0, stock: 3, low_stock_threshold: 5, barcode: null },
  ]);
};