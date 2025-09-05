// Supabase Configuration
// আপনার Supabase প্রজেক্টের URL এবং API Key এখানে দিন

const SUPABASE_URL = 'https://zwzowlizzhdknlptomjc.supabase.co'; // আপনার Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3em93bGl6emhka25scHRvbWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MDMwMzcsImV4cCI6MjA3MjQ3OTAzN30.IHjKjpjpFXXftQeopcljyajvIwTClHSpKFRruKST-EM'; // আপনার Supabase Anon Key

// Supabase Client Initialize
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Database Table Names
const TABLES = {
    PRODUCTS: 'products',
    ORDERS: 'orders',
    CATEGORIES: 'categories'
};

// Order Status
const ORDER_STATUS = {
    PENDING: 'pending',
    PREPARING: 'preparing',
    DELIVERED: 'delivered',
    COMPLETED: 'completed'
};

// Export for use in other files
window.supabaseConfig = {
    supabase,
    TABLES,
    ORDER_STATUS
};