const express = require('express');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// MongoDB connection
// mongoose.connect(process.env.MONGODB_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// }).then(() => console.log('MongoDB connected'))
//   .catch(err => console.error('MongoDB connection error:', err));


mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Root endpoint
app.get('/', (req, res) => {
  const connectionStatus = mongoose.connection.readyState;
  const statusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  res.status(200).json({
    message: 'API is running',
    mongoDBStatus: statusMap[connectionStatus] || 'unknown'
  });
});



// Schemas
const categorySchema = new mongoose.Schema({
  restaurantId: String,
  order: Number,
  name: String,
  image: String,
  imagePublicId: String
});

const offerSchema = new mongoose.Schema({
  restaurantId: String,
  title: String,
  description: String,
  discount: Number,
  tags: [String],
  validUntil: Date,
  active: Boolean
});

const productSchema = new mongoose.Schema({
  restaurantId: String,
  name: String,
  description: String,
  price: Number,
  image: String,
  imagePublicId: String,
  categoryId: String,
  available: Boolean
});

const restaurantAdminSchema = new mongoose.Schema({
  restaurantId: String,
  createdAt: Date,
  username: String,
  password: String,
  restaurantName: String
});

const restaurantSchema = new mongoose.Schema({
  adminId: String,
  name: String,
  address: String,
  contact: String,
  logo: String,
  logoPublicId: String
});

// Models
const Category = mongoose.model('Category', categorySchema);
const Offer = mongoose.model('Offer', offerSchema);
const Product = mongoose.model('Product', productSchema);
const RestaurantAdmin = mongoose.model('RestaurantAdmin', restaurantAdminSchema);
const Restaurant = mongoose.model('Restaurant', restaurantSchema);

// Helper function to upload image to Cloudinary
const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: `menumaster/${folder}` },
      (error, result) => {
        if (error) reject(error);
        else resolve({ url: result.secure_url, publicId: result.public_id });
      }
    ).end(buffer);
  });
};

// Helper function to delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
  }
};

// CRUD Routes for Categories
app.post('/api/categories', upload.single('image'), async (req, res) => {
  try {
    let imageData = { url: '', publicId: '' };
    if (req.file) {
      imageData = await uploadToCloudinary(req.file.buffer, 'categories');
    }
    
    const category = new Category({
      ...req.body,
      image: imageData.url,
      imagePublicId: imageData.publicId
    });
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/categories/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/categories/:id', upload.single('image'), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    let imageData = { url: category.image, publicId: category.imagePublicId };
    if (req.file) {
      if (category.imagePublicId) await deleteFromCloudinary(category.imagePublicId);
      imageData = await uploadToCloudinary(req.file.buffer, 'categories');
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      { ...req.body, image: imageData.url, imagePublicId: imageData.publicId },
      { new: true }
    );
    res.json(updatedCategory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    
    if (category.imagePublicId) await deleteFromCloudinary(category.imagePublicId);
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD Routes for Offers
app.post('/api/offers', async (req, res) => {
  try {
    const offer = new Offer(req.body);
    await offer.save();
    res.status(201).json(offer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/offers', async (req, res) => {
  try {
    const offers = await Offer.find();
    res.json(offers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/offers/:id', async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    res.json(offer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/offers/:id', async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    res.json(offer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/offers/:id', async (req, res) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    res.json({ message: 'Offer deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD Routes for Products
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    let imageData = { url: '', publicId: '' };
    if (req.file) {
      imageData = await uploadToCloudinary(req.file.buffer, 'products');
    }
    
    const product = new Product({
      ...req.body,
      image: imageData.url,
      imagePublicId: imageData.publicId
    });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', upload.single('image'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    let imageData = { url: product.image, publicId: product.imagePublicId };
    if (req.file) {
      if (product.imagePublicId) await deleteFromCloudinary(product.imagePublicId);
      imageData = await uploadToCloudinary(req.file.buffer, 'products');
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, image: imageData.url, imagePublicId: imageData.publicId },
      { new: true }
    );
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    if (product.imagePublicId) await deleteFromCloudinary(product.imagePublicId);
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD Routes for Restaurant Admins
app.post('/api/restaurant-admins', async (req, res) => {
  try {
    const admin = new RestaurantAdmin(req.body);
    await admin.save();
    res.status(201).json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/restaurant-admins', async (req, res) => {
  try {
    const admins = await RestaurantAdmin.find();
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/restaurant-admins/:id', async (req, res) => {
  try {
    const admin = await RestaurantAdmin.findById(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/restaurant-admins/:id', async (req, res) => {
  try {
    const admin = await RestaurantAdmin.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/restaurant-admins/:id', async (req, res) => {
  try {
    const admin = await RestaurantAdmin.findByIdAndDelete(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json({ message: 'Admin deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD Routes for Restaurants
app.post('/api/restaurants', upload.single('logo'), async (req, res) => {
  try {
    let logoData = { url: '', publicId: '' };
    if (req.file) {
      logoData = await uploadToCloudinary(req.file.buffer, 'restaurants');
    }
    
    const restaurant = new Restaurant({
      ...req.body,
      logo: logoData.url,
      logoPublicId: logoData.publicId
    });
    await restaurant.save();
    res.status(201).json(restaurant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/restaurants', async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/restaurants/:id', upload.single('logo'), async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    let logoData = { url: restaurant.logo, publicId: restaurant.logoPublicId };
    if (req.file) {
      if (restaurant.logoPublicId) await deleteFromCloudinary(restaurant.logoPublicId);
      logoData = await uploadToCloudinary(req.file.buffer, 'restaurants');
    }

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      { ...req.body, logo: logoData.url, logoPublicId: logoData.publicId },
      { new: true }
    );
    res.json(updatedRestaurant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    
    if (restaurant.logoPublicId) await deleteFromCloudinary(restaurant.logoPublicId);
    await Restaurant.findByIdAndDelete(req.params.id);
    res.json({ message: 'Restaurant deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));