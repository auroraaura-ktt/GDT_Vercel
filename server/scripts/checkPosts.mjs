import mongoose from 'mongoose'
import { connectMongoDB } from '../src/config/mongodb.js'

await connectMongoDB()
const docs = await mongoose.connection.db.collection('socialposts').find({}).sort({ createdAt: -1 }).limit(20).toArray()
console.log('count=' + docs.length)
console.log(JSON.stringify(docs, null, 2))
await mongoose.disconnect()
