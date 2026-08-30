import { connectMongoDB } from './src/config/mongodb.js'
import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  id: String,
  username: String,
  email: String,
  passwordHash: String,
  role: String,
  verified: Boolean,
  createdAt: String,
  source: String,
}, { timestamps: true })

const UserModel = mongoose.models.User || mongoose.model('User', userSchema)

await connectMongoDB()
const users = await UserModel.find({
  $or: [
    { email: 'kyaw_thein_tun@miitverse.com' },
    { email: 'shine_wunna_tun@miitverse.com' },
    { email: 'kyaw_lin@miitverse.com' },
    { email: 'minn_khant@miitverse.com' },
  ],
}).lean()

console.log(JSON.stringify(users, null, 2))
await mongoose.disconnect()
