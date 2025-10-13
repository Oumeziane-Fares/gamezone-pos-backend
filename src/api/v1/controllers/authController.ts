import { Request, Response, NextFunction } from 'express';
import * as authService from '../../../services/authService';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    const newUser = await authService.registerUser({ username, password });
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    const token = await authService.loginUser({ username, password });

    if (!token) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
};