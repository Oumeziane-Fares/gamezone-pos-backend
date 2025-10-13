import db from '../db/knex';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, NewUser } from '../types'; // Import NewUser as well

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';

// The input 'userData' now correctly uses the 'NewUser' type
export const registerUser = async (userData: NewUser): Promise<Omit<User, 'password_hash'>> => {
  const password_hash = await bcrypt.hash(userData.password, 10);
  const [newUser] = await db('users').insert({ username: userData.username, password_hash }).returning(['id', 'username']);
  return newUser;
};

// The input 'userData' here also uses the 'NewUser' type
export const loginUser = async (userData: NewUser): Promise<string | null> => {
  const user = await db('users').where({ username: userData.username }).first();
  if (!user) {
    return null; // User not found
  }

  const isPasswordValid = await bcrypt.compare(userData.password, user.password_hash);
  if (!isPasswordValid) {
    return null; // Invalid password
  }

  // Passwords match, generate a token
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
  return token;
};