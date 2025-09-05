// Global Variables
let allProducts = [];
let selectedProducts = [];
let currentCategory = 'all';
let autoDetectedTableNumber = null; // New global variable to store auto-detected table number
let availableCategories = []; // Store available categories for navbar
let categoriesData = []; // Store full categories data from database

// DOM Elements
const productsGrid = document.getElementById('productsGrid');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('emptyState');
const placeOrderBtn = document.getElementById('placeOrderBtn');
const selectedCount = document.getElementById('selectedCount');
const cartCount = document.querySelector('.cart-count');
const searchInput = document.getElementById('searchInput');
const orderModal = document.getElementById('orderModal');
const successMessage = document.getElementById('successMessage');
const navCategories = document.getElementById('navCategories');

// Debug: Check if navCategories element exists
console.log('navCategories element:', navCategories);

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    console.log('App initialized');
    loadProducts();
    setupEventListeners();
    detectTableNumberFromUrl(); // New function call to detect table number
    
    // Test categories removed - now using database
});

// Setup Event Listeners
function setupEventListeners() {
    // All button navigation
    const allButton = document.querySelector('.nav-all');
    if (allButton) {
        allButton.addEventListener('click', function() {
            switchCategory('all');
            updateActiveNavState('all');
        });
    }

    // Category navigation (will be set up after categories are loaded)
    setupCategoryNavigation();

    // Search functionality
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        filterProducts(searchTerm);
    });

    // Close modal when clicking outside
    orderModal.addEventListener('click', function(e) {
        if (e.target === orderModal) {
            closeOrderModal();
        }
    });

    // Auto-hide search bar on scroll
    let lastScrollTop = 0;
    const searchSection = document.querySelector('.search-section');
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down - hide search bar
            searchSection.style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up - show search bar
            searchSection.style.transform = 'translateY(0)';
        }
        
        lastScrollTop = scrollTop;
    });
}

// Detect Table Number from URL
function detectTableNumberFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const tableParam = urlParams.get('table');
    if (tableParam) {
        const parsedTableNumber = parseInt(tableParam);
        if (!isNaN(parsedTableNumber) && parsedTableNumber > 0 && parsedTableNumber <= 20) { // Assuming max 20 tables
            autoDetectedTableNumber = parsedTableNumber;
            console.log('Auto-detected Table Number:', autoDetectedTableNumber);
        } else {
            console.warn('Invalid table number in URL parameter:', tableParam);
        }
    }
}

// Load Products from Supabase
async function loadProducts() {
    try {
        loading.style.display = 'block';
        productsGrid.style.display = 'none';
        emptyState.style.display = 'none';

        const { data, error } = await window.supabaseConfig.supabase
            .from(window.supabaseConfig.TABLES.PRODUCTS)
            .select('*');

        if (error) {
            throw error;
        }

        allProducts = data || [];
        
        // Sort products by priority
        allProducts.sort((a, b) => {
            const priorityOrder = {
                'most_selling': 1,
                'high': 2, 
                'medium': 3,
                'low': 4
            };
            
            const aPriority = priorityOrder[a.priority] || 4;
            const bPriority = priorityOrder[b.priority] || 4;
            
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            
            // If same priority, sort by created_at (newest first)
            return new Date(b.created_at) - new Date(a.created_at);
        });
        
        // Extract and sort categories
        await extractAndSortCategories();
        
        // Categories loaded from database
        
        // Load categories in navbar
        loadCategoriesInNavbar();
        
        displayProducts(allProducts);
        
    } catch (error) {
        console.error('Error loading products:', error);
        showError('পণ্য লোড করতে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।');
    } finally {
        loading.style.display = 'none';
    }
}

// Display Products
function displayProducts(products) {
    if (products.length === 0) {
        productsGrid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    productsGrid.style.display = 'grid';
    emptyState.style.display = 'none';

    productsGrid.innerHTML = products.map(product => `
        <div class="product-card ${product.priority || 'low'}" data-id="${product.id}" onclick="toggleProduct(${product.id})">
            ${getCustomerPriorityBadge(product.priority)}
            <img src="${product.image_url || getPlaceholderImage()}" 
                 alt="${product.name}" 
                 class="product-image"
                 onerror="handleImageError(this)">
            <div class="product-checkbox">
                <i class="fas fa-check"></i>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">৳${product.price}</div>
                <span class="product-category">${getCategoryName(product.category)}</span>
            </div>
        </div>
    `).join('');

    // Update selected states
    updateProductSelection();
}

// Toggle Product Selection
function toggleProduct(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const existingIndex = selectedProducts.findIndex(p => p.id === productId);
    
    if (existingIndex > -1) {
        // Remove from selection
        selectedProducts.splice(existingIndex, 1);
    } else {
        // Add to selection with default quantity
        selectedProducts.push({
            ...product,
            quantity: 1
        });
    }

    updateProductSelection();
    updateOrderButton();
}

// Update Product Selection Visual State
function updateProductSelection() {
    const productCards = document.querySelectorAll('.product-card');
    productCards.forEach(card => {
        const productId = parseInt(card.dataset.id);
        const isSelected = selectedProducts.some(p => p.id === productId);
        
        if (isSelected) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
}

// Update Order Button
function updateOrderButton() {
    const count = selectedProducts.length;
    
    if (count > 0) {
        placeOrderBtn.style.display = 'block';
        selectedCount.textContent = count;
        cartCount.textContent = count;
        cartCount.style.display = 'flex';
    } else {
        placeOrderBtn.style.display = 'none';
        cartCount.style.display = 'none';
    }
}

// Extract and Sort Categories
async function extractAndSortCategories() {
    try {
        // Get categories from Supabase with proper sorting
        const { data: categoriesData, error: categoriesError } = await window.supabaseConfig.supabase
            .from(window.supabaseConfig.TABLES.CATEGORIES)
            .select('*')
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true });

        if (categoriesError) {
            console.error('Error loading categories:', categoriesError);
            // Fallback to product-based categories
            extractCategoriesFromProducts();
            return;
        }

        // Get categories that actually have products
        const categorySet = new Set();
        allProducts.forEach(product => {
            if (product.category) {
                categorySet.add(product.category.toLowerCase());
            }
        });

        // For now, show all categories from admin panel (for testing)
        // TODO: Later filter by products that actually exist
        // Store full categories data
        window.categoriesData = categoriesData || [];
        
        availableCategories = (categoriesData || [])
            .map(category => category.key.toLowerCase());
        
        console.log('Categories from database:', categoriesData);
        console.log('Categories with products:', Array.from(categorySet));
        console.log('Available categories (admin sorted):', availableCategories);
        console.log('Category details:', (categoriesData || [])
            .map(c => ({ key: c.key, name: c.name, sort_order: c.sort_order, icon: c.icon, icon_type: c.icon_type })));
        
    } catch (error) {
        console.error('Error loading categories:', error);
        // Fallback to product-based categories
        extractCategoriesFromProducts();
    }
}

// Fallback function to extract categories from products
function extractCategoriesFromProducts() {
    const categorySet = new Set();
    
    allProducts.forEach(product => {
        if (product.category) {
            categorySet.add(product.category.toLowerCase());
        }
    });
    
    // Convert to array and sort alphabetically
    availableCategories = Array.from(categorySet).sort();
    
    console.log('Available categories (fallback):', availableCategories);
}

// Load Categories in Navbar
function loadCategoriesInNavbar() {
    if (!navCategories) {
        console.error('navCategories element not found!');
        return;
    }
    
    console.log('Loading categories in navbar:', availableCategories);
    
    // Clear existing categories
    navCategories.innerHTML = '';
    
    if (availableCategories.length === 0) {
        console.warn('No categories available to load!');
        return;
    }
    
    // Add category buttons
    availableCategories.forEach(category => {
        const categoryButton = document.createElement('button');
        categoryButton.className = 'nav-category-item';
        categoryButton.dataset.category = category;
        
        // Get category data from database
        const categoryData = window.categoriesData.find(cat => cat.key.toLowerCase() === category);
        const categoryInfo = getCategoryInfo(category, categoryData);
        
        // Handle image icons
        let iconHtml = '';
        if (categoryData && categoryData.icon_type === 'image' && categoryData.icon) {
            iconHtml = `<img src="${categoryData.icon}" alt="${categoryInfo.name}" style="width: 20px; height: 20px; object-fit: cover; border-radius: 4px;">`;
        } else {
            iconHtml = `<i class="${categoryInfo.icon}"></i>`;
        }
        
        categoryButton.innerHTML = `
            ${iconHtml}
            <span>${categoryInfo.name}</span>
        `;
        
        categoryButton.addEventListener('click', function() {
            switchCategory(category);
            updateActiveNavState(category);
        });
        
        navCategories.appendChild(categoryButton);
    });
    
    console.log('Categories loaded in navbar:', availableCategories.length);
}

// Get Category Information
function getCategoryInfo(category, categoryData = null) {
    // If we have category data from database, use it
    if (categoryData) {
        return {
            icon: categoryData.icon || 'fas fa-utensils',
            name: categoryData.name || getCategoryName(category)
        };
    }
    const categoryMap = {
        'drinks': { icon: 'fas fa-coffee', name: 'পানীয়' },
        'burger': { icon: 'fas fa-hamburger', name: 'বার্গার' },
        'pizza': { icon: 'fas fa-pizza-slice', name: 'পিজা' },
        'rice': { icon: 'fas fa-bowl-rice', name: 'ভাত' },
        'chicken': { icon: 'fas fa-drumstick-bite', name: 'চিকেন' },
        'beef': { icon: 'fas fa-hamburger', name: 'গরুর মাংস' },
        'fish': { icon: 'fas fa-fish', name: 'মাছ' },
        'vegetable': { icon: 'fas fa-carrot', name: 'সবজি' },
        'dessert': { icon: 'fas fa-ice-cream', name: 'মিষ্টি' },
        'snacks': { icon: 'fas fa-cookie-bite', name: 'নাস্তা' },
        'noodles': { icon: 'fas fa-utensils', name: 'নুডলস' }
    };
    
    return categoryMap[category.toLowerCase()] || { 
        icon: 'fas fa-utensils', 
        name: getCategoryName(category) 
    };
}

// Setup Category Navigation
function setupCategoryNavigation() {
    // This function will be called after categories are loaded
    // The actual event listeners are set up in loadCategoriesInNavbar()
}

// Update Active Navigation State
function updateActiveNavState(activeCategory) {
    // Update All button
    const allButton = document.querySelector('.nav-all');
    if (allButton) {
        if (activeCategory === 'all') {
            allButton.classList.add('active');
        } else {
            allButton.classList.remove('active');
        }
    }
    
    // Update category buttons
    const categoryButtons = document.querySelectorAll('.nav-category-item');
    categoryButtons.forEach(button => {
        if (button.dataset.category === activeCategory) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// Switch Category
function switchCategory(category) {
    currentCategory = category;
    
    let filteredProducts;
    if (category === 'all') {
        filteredProducts = allProducts;
    } else {
        filteredProducts = allProducts.filter(product => 
            product.category.toLowerCase() === category.toLowerCase()
        );
    }

    displayProducts(filteredProducts);
}

// Filter Products by Search
function filterProducts(searchTerm) {
    if (!searchTerm) {
        switchCategory(currentCategory);
        return;
    }

    const filteredProducts = allProducts.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm);
        const matchesCategory = currentCategory === 'all' || 
                               product.category.toLowerCase() === currentCategory.toLowerCase();
        return matchesSearch && matchesCategory;
    });

    displayProducts(filteredProducts);
}

// Show Order Summary
function showOrderSummary() {
    if (selectedProducts.length === 0) return;

    const orderItems = document.getElementById('orderItems');
    const totalPrice = document.getElementById('totalPrice');
    const tableNumberSection = document.getElementById('tableNumberSection'); // Get the table number section

    // Display selected items
    renderOrderItems();

    // Update table number display
    let tableNumberDisplayHtml = '';
    if (autoDetectedTableNumber) {
        tableNumberDisplayHtml = `
            <div class="input-row">
                <div class="name-input-section">
                    <label for="customerName">আপনার নাম:</label>
                    <input type="text" id="customerName" placeholder="নাম লিখুন">
                </div>
                <div class="table-display-section">
                    <p>টেবিল নম্বর: <strong>${autoDetectedTableNumber}</strong></p>
                </div>
            </div>
        `;
    } else {
        tableNumberDisplayHtml = `
            <div class="input-row">
                <div class="name-input-section">
                    <label for="customerName">আপনার নাম:</label>
                    <input type="text" id="customerName" placeholder="নাম লিখুন">
                </div>
                <div class="table-input-section">
                    <label for="manualTableNumber">টেবিল নম্বর:</label>
                    <select id="manualTableNumber">
                        <option value="">নির্বাচন করুন</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                        <option value="6">6</option>
                        <option value="7">7</option>
                        <option value="8">8</option>
                        <option value="9">9</option>
                        <option value="10">10</option>
                        <option value="11">11</option>
                        <option value="12">12</option>
                        <option value="13">13</option>
                        <option value="14">14</option>
                        <option value="15">15</option>
                        <option value="16">16</option>
                        <option value="17">17</option>
                        <option value="18">18</option>
                        <option value="19">19</option>
                        <option value="20">20</option>
                    </select>
                </div>
            </div>
        `;
    }
    
    tableNumberSection.innerHTML = tableNumberDisplayHtml;

    // Calculate total
    updateOrderSummaryTotals();

    // Show modal
    orderModal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Close Order Modal
function closeOrderModal() {
    orderModal.classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Update Quantity of a product in the order summary
function updateQuantity(productId, type) {
    const productIndex = selectedProducts.findIndex(p => p.id === productId);
    if (productIndex === -1) return;

    if (type === 'increment') {
        selectedProducts[productIndex].quantity++;
    } else if (type === 'decrement') {
        if (selectedProducts[productIndex].quantity > 1) {
            selectedProducts[productIndex].quantity--;
        }
        // No 'else' block here, so it won't remove the product or go below 1
    }

    // Re-render the order items and update totals
    renderOrderItems();
    updateOrderSummaryTotals();
    updateOrderButton(); // Update the main order button count as well
}

// Render Order Items (re-usable function)
function renderOrderItems() {
    const orderItems = document.getElementById('orderItems');
    orderItems.innerHTML = selectedProducts.map(product => `
        <div class="order-item">
            <div class="item-info">
                <div class="item-title-section">
                    <img src="${product.image_url || getPlaceholderImage()}" alt="${product.name}" class="order-item-image" onerror="handleImageError(this)">
                    <h4>${product.name}</h4>
                </div>
                <div class="item-quantity-controls">
                    <p>পরিমাণ: </p>
                    <button class="quantity-btn decrement" data-id="${product.id}">-</button>
                    <span class="quantity-display">${product.quantity}</span>
                    <button class="quantity-btn increment" data-id="${product.id}">+</button>
                </div>
            </div>
            <div class="item-price">৳${product.price * product.quantity}</div>
        </div>
    `).join('');

    // Re-attach event listeners for newly rendered buttons
    orderItems.querySelectorAll('.quantity-btn').forEach(button => {
        button.addEventListener('click', function(event) {
            event.stopPropagation();
            const productId = parseInt(this.dataset.id);
            const type = this.classList.contains('increment') ? 'increment' : 'decrement';
            updateQuantity(productId, type);
        });
    });
}

// Update Order Summary Totals
function updateOrderSummaryTotals() {
    const totalPriceElement = document.getElementById('totalPrice');
    const itemCountElement = document.getElementById('itemCount');
    
    const total = selectedProducts.reduce((sum, product) => 
        sum + (product.price * product.quantity), 0
    );
    
    const totalItems = selectedProducts.reduce((sum, product) => 
        sum + product.quantity, 0
    );
    
    totalPriceElement.textContent = total;
    itemCountElement.textContent = totalItems;
}

// Confirm Order
async function confirmOrder() {
    if (selectedProducts.length === 0) return;

    try {
        const customerName = document.getElementById('customerName').value;
        let tableNumberToUse = autoDetectedTableNumber;

        if (!tableNumberToUse) {
            // If not auto-detected, try to get from manual input
            const manualTableNumber = document.getElementById('manualTableNumber').value;
            if (!manualTableNumber) {
                showError('দয়া করে টেবিল নম্বর নির্বাচন করুন।');
                return;
            }
            tableNumberToUse = parseInt(manualTableNumber);
        }
        
        const orderData = {
            products: selectedProducts.map(p => ({
                id: p.id,
                name: p.name,
                price: p.price,
                quantity: p.quantity
            })),
            total_price: selectedProducts.reduce((sum, product) => 
                sum + (product.price * product.quantity), 0
            ),
            table_number: tableNumberToUse,
            customer_name: customerName || null, // Add customer name, or null if empty
            status: window.supabaseConfig.ORDER_STATUS.PENDING,
            created_at: new Date().toISOString()
        };

        const { data, error } = await window.supabaseConfig.supabase
            .from(window.supabaseConfig.TABLES.ORDERS)
            .insert([orderData])
            .select();

        if (error) {
            throw error;
        }

        console.log('Order placed successfully:', data);
        
        // Reset selection
        selectedProducts = [];
        updateProductSelection();
        updateOrderButton();
        
        // Close modal and show success
        closeOrderModal();
        showSuccessMessage();

        // Clear customer name and manual table number (if applicable)
        document.getElementById('customerName').value = '';
        if (!autoDetectedTableNumber) {
            document.getElementById('manualTableNumber').value = '';
        }

    } catch (error) {
        console.error('Error placing order:', error);
        showError('অর্ডার দিতে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।');
    }
}

// Show Success Message
function showSuccessMessage() {
    successMessage.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Close Success Message
function closeSuccessMessage() {
    successMessage.classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Get Category Name in Bengali
function getCategoryName(category) {
    const categoryNames = {
        'drinks': 'পানীয়',
        'burger': 'বার্গার',
        'pizza': 'পিজা',
        'rice': 'ভাত',
        'chicken': 'চিকেন',
        'beef': 'গরুর মাংস',
        'fish': 'মাছ',
        'vegetable': 'সবজি',
        'dessert': 'মিষ্টি',
        'snacks': 'নাস্তা'
    };
    
    return categoryNames[category.toLowerCase()] || category;
}

// Show Error Message
function showError(message) {
    // Create error toast
    const errorToast = document.createElement('div');
    errorToast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        font-weight: 500;
        max-width: 300px;
        animation: slideInRight 0.3s ease;
    `;
    
    errorToast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(errorToast);
    
    // Remove after 5 seconds
    setTimeout(() => {
        errorToast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(errorToast);
        }, 300);
    }, 5000);
}

// Priority Helper Functions for Customer
// গ্রাহকদের জন্য প্রাধিকার সহায়ক ফাংশন

function getCustomerPriorityBadge(priority) {
    const badges = {
        'most_selling': '<div class="customer-priority-badge most-selling"><i class="fas fa-fire"></i> Top Selling</div>',
        'high': '<div class="customer-priority-badge high"><i class="fas fa-star"></i> Popular</div>',
        'medium': '',
        'low': ''
    };
    
    return badges[priority] || '';
}

// Image Helper Functions
// ছবি সহায়ক ফাংশন

// Generate placeholder image as base64 SVG
// প্লেসহোল্ডার ছবি তৈরি করা
function getPlaceholderImage() {
    // Simple SVG placeholder as base64
    const svg = `
        <svg width="300" height="200" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="300" height="200" fill="#F3F4F6"/>
            <rect x="125" y="75" width="50" height="50" fill="#9B9B9B" rx="4"/>
            <rect x="140" y="90" width="20" height="20" fill="white" rx="2"/>
            <text x="150" y="145" text-anchor="middle" fill="#6B7280" font-family="Arial" font-size="14">No Image</text>
        </svg>
    `;
    return 'data:image/svg+xml;base64,' + btoa(svg);
}

// Handle image loading errors
// ছবি লোডিং error হ্যান্ডল করা
function handleImageError(img) {
    // Prevent infinite loop
    if (img.dataset.errorHandled) return;
    img.dataset.errorHandled = 'true';
    
    // Set placeholder
    img.src = getPlaceholderImage();
    
    // Remove onerror to prevent further calls
    img.onerror = null;
}

// Add CSS animation for error toast
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);