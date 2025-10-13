import { Request, Response, NextFunction } from 'express';
import * as productService from '../../../services/productService';
import { productSchema } from '../validation/productValidation';
import { ulid } from 'ulid';

// Controller to handle GET /products
export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await productService.findAllProducts();
    res.status(200).json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

// Controller to handle GET /products/:id
export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productService.findProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found' 
      });
    }
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// POST /products
export const createNewProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Map camelCase to snake_case for database
    const productData = {
      id: ulid(),
      name: req.body.name,
      category: req.body.category,
      price: parseFloat(req.body.price),
      cost: parseFloat(req.body.cost),
      stock: parseInt(req.body.stock),
      low_stock_threshold: parseInt(req.body.lowStockThreshold || req.body.low_stock_threshold || 10),
      barcode: req.body.barcode || null,
      description: req.body.description || null
    };

    // Validate the data
    const validatedData = productSchema.parse(productData);
    const newProduct = await productService.createProduct(validatedData);
    
    res.status(201).json({
      success: true,
      data: newProduct
    });
  } catch (error) {
    next(error);
  }
};

// PUT /products/:id
export const updateExistingProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Map camelCase to snake_case for database
    const updateData: any = {};
    
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.category !== undefined) updateData.category = req.body.category;
    if (req.body.price !== undefined) updateData.price = parseFloat(req.body.price);
    if (req.body.cost !== undefined) updateData.cost = parseFloat(req.body.cost);
    if (req.body.stock !== undefined) updateData.stock = parseInt(req.body.stock);
    if (req.body.lowStockThreshold !== undefined || req.body.low_stock_threshold !== undefined) {
      updateData.low_stock_threshold = parseInt(req.body.lowStockThreshold || req.body.low_stock_threshold);
    }
    if (req.body.barcode !== undefined) updateData.barcode = req.body.barcode || null;
    if (req.body.description !== undefined) updateData.description = req.body.description || null;

    const updatedProduct = await productService.updateProduct(req.params.id, updateData);
    if (!updatedProduct) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      data: updatedProduct
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /products/:id
export const deleteExistingProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deletedCount = await productService.deleteProduct(req.params.id);
    if (deletedCount === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found' 
      });
    }
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};