import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

// Load configuration
const config = JSON.parse(fs.readFileSync(path.join('config', 'database.json'), 'utf-8'));

// Connect to MongoDB
export async function connectToDatabase() {
  try {
    const connectionString = `mongodb://${config.host}:${config.port}/${config.name}`;
    await mongoose.connect(connectionString);
    console.log('Connected to MongoDB successfully');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

export default mongoose;
