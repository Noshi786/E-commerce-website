import 'dotenv/config'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import connectDB from '../config/db.js'

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env

if (!ADMIN_NAME?.trim() || !ADMIN_EMAIL?.trim() || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before creating an admin account.')
  process.exitCode = 1
} else if (ADMIN_PASSWORD.length < 12) {
  console.error('ADMIN_PASSWORD must be at least 12 characters long.')
  process.exitCode = 1
} else {
  try {
    await connectDB()
    const email = ADMIN_EMAIL.trim().toLowerCase()
    const user = await User.findOne({ email })
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12)

    if (user) {
      user.name = ADMIN_NAME.trim()
      user.password = hashedPassword
      user.role = 'admin'
      user.isActive = true
      await user.save()
      console.log(`Administrator account updated for ${email}.`)
    } else {
      await User.create({
        name: ADMIN_NAME.trim(),
        email,
        password: hashedPassword,
        role: 'admin',
        isActive: true,
      })
      console.log(`Administrator account created for ${email}.`)
    }
  } catch (error) {
    console.error(`Could not provision the administrator account: ${error.message}`)
    process.exitCode = 1
  } finally {
    await User.db?.close()
  }
}
