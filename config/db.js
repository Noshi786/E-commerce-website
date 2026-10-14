import mongoose from 'mongoose';

let connectionPromise;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  try {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI);
    const conn = await connectionPromise;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    connectionPromise = undefined;
    return conn.connection;
  } catch (error) {
    connectionPromise = undefined;
    throw error;
  }
};

export default connectDB;
