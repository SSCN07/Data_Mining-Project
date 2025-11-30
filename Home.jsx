import { useState, useEffect } from "react";
import {
  Search,
  Smartphone,
  Car,
  Laptop,
  Headphones,
  X,
  ArrowLeft,
  ShoppingBag,
  Shield,
  Package,
  CreditCard,
  TrendingUp,
 
} from "lucide-react";



class AprioriRecommender {
  constructor(minSupport = 0.1, minConfidence = 0.3) {
    this.minSupport = minSupport;
    this.minConfidence = minConfidence;
    this.transactions = [];
    this.frequentItemsets = [];
    this.rules = [];
  }

  addTransaction(items) { //each transaction is an array of item identifiers.
    this.transactions.push([...new Set(items)]);
  }

  calculateSupport(itemset) { //the percentage of transactions containing a specific itemset.
    if (this.transactions.length === 0) return 0;
    let count = 0;
    for (let transaction of this.transactions) {
      if (itemset.every(item => transaction.includes(item))) {
        count++;
      }
    }
    return count / this.transactions.length;
  }

  generateCandidates(previousItemsets, k) {
    const candidates = [];
    
    for (let i = 0; i < previousItemsets.length; i++) {
      for (let j = i + 1; j < previousItemsets.length; j++) {
        const union = [...new Set([...previousItemsets[i], ...previousItemsets[j]])];
        if (union.length === k) {
          candidates.push(union);
        }
      }
    }
    
    return candidates;
  }

  findFrequentItemsets() {
    if (this.transactions.length === 0) return [];

    const allItems = [...new Set(this.transactions.flat())];
    let frequentItemsets = [];
    
    let currentItemsets = allItems.map(item => [item]).filter(itemset => {
      const support = this.calculateSupport(itemset);
      return support >= this.minSupport;
    });
    
    frequentItemsets.push(...currentItemsets);
    let k = 2;
    
    while (currentItemsets.length > 0 && k <= 4) {
      const candidates = this.generateCandidates(currentItemsets, k);
      currentItemsets = candidates.filter(itemset => {
        const support = this.calculateSupport(itemset);
        return support >= this.minSupport;
      });
      
      if (currentItemsets.length > 0) {
        frequentItemsets.push(...currentItemsets);
      }
      k++;
    }
    
    this.frequentItemsets = frequentItemsets;
    return frequentItemsets;
  }

  generateSubsets(arr, size) {
    const result = [];
    const generate = (start, subset) => {
      if (subset.length === size) {
        result.push([...subset]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        subset.push(arr[i]);
        generate(i + 1, subset);
        subset.pop();
      }
    };
    generate(0, []);
    return result;
  }

  generateRules() {
    const rules = [];
    const largeItemsets = this.frequentItemsets.filter(itemset => itemset.length >= 2);
    
    for (let itemset of largeItemsets) {
      // Generate all possible subsets as antecedents
      for (let size = 1; size < itemset.length; size++) {
        const subsets = this.generateSubsets(itemset, size);
        
        for (let antecedent of subsets) {
          const consequent = itemset.filter(item => !antecedent.includes(item));
          
          if (consequent.length === 0) continue;
          
          const support = this.calculateSupport(itemset);
          const antecedentSupport = this.calculateSupport(antecedent);
          const confidence = support / antecedentSupport;
          const consequentSupport = this.calculateSupport(consequent);
          const lift = consequentSupport > 0 ? confidence / consequentSupport : 0;
          
          if (confidence >= this.minConfidence && lift > 1) {
            rules.push({
              antecedent,
              consequent,
              support,
              confidence,
              lift
            });
          }
        }
      }
    }
    
    this.rules = rules.sort((a, b) => {
      // Prioritize rules with higher lift and confidence
      const liftDiff = b.lift - a.lift;
      return liftDiff !== 0 ? liftDiff : b.confidence - a.confidence;
    });
    return this.rules;
  }

  calculateMatchScore(antecedent, searchTerms) {
    let matches = 0;
    let totalTerms = searchTerms.length;
    
    for (let term of searchTerms) {
      if (antecedent.some(item => item.includes(term) || term.includes(item.replace('Car_', '').replace('Phone_', '').replace('Laptop_', '')))) {
        matches++;
      }
    }
    
    return matches / totalTerms;
  }

  getRecommendations(productName, limit = 4) {
    const recommendationScores = new Map();
    const searchTerms = this.generateSearchTerms(productName);
    
    for (let rule of this.rules) {
      const matchScore = this.calculateMatchScore(rule.antecedent, searchTerms);
      
      if (matchScore > 0) {
        for (let product of rule.consequent) {
          // Filter out services and the original product
          if (!product.startsWith('Service_') && 
              !searchTerms.some(term => product.includes(term))) {
            
            const currentScore = recommendationScores.get(product) || {
              name: product,
              totalScore: 0,
              confidence: 0,
              support: 0,
              occurrences: 0
            };
            
            // Weight by confidence, lift, and match score
            const score = rule.confidence * rule.lift * matchScore;
            
            recommendationScores.set(product, {
              name: product,
              totalScore: currentScore.totalScore + score,
              confidence: Math.max(currentScore.confidence, rule.confidence),
              support: Math.max(currentScore.support, rule.support),
              lift: rule.lift,
              occurrences: currentScore.occurrences + 1
            });
          }
        }
      }
    }
    
    return Array.from(recommendationScores.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, limit);
  }

  generateSearchTerms(productName) {
    const terms = new Set();
    
    // Add the full product name
    terms.add(productName);
    
    // Extract brand and main keywords
    const words = productName.split(' ').filter(w => w.length > 2);
    
    // Add brand variations
    if (words.length > 0) {
      terms.add(words[0]); // Brand name
      terms.add(`Car_${words[0]}`);
      terms.add(`Phone_${words[0]}`);
      terms.add(`Laptop_${words[0]}`);
    }
    
    // Add category detection
    const lowerName = productName.toLowerCase();
    if (lowerName.includes('phone') || lowerName.includes('iphone') || lowerName.includes('galaxy')) {
      terms.add('Category_Phone');
    } else if (lowerName.includes('laptop') || lowerName.includes('macbook') || lowerName.includes('notebook')) {
      terms.add('Category_Laptop');
    } else {
      terms.add('Category_Car');
    }
    
    // Add price-related terms
    if (lowerName.includes('pro') || lowerName.includes('premium') || lowerName.includes('luxury')) {
      terms.add('Price_Premium');
      terms.add('Price_Luxury');
    } else if (lowerName.includes('budget') || lowerName.includes('basic') || lowerName.includes('lite')) {
      terms.add('Price_Budget');
    } else {
      terms.add('Price_MidRange');
    }
    
    return Array.from(terms);
  }

  getRelatedServices(productName) {
    const searchTerms = this.generateSearchTerms(productName);
    const serviceRules = this.rules.filter(rule => 
      rule.antecedent.some(item => searchTerms.some(term => item.includes(term))) && 
      rule.consequent.some(item => item.startsWith('Service_'))
    );
    
    return serviceRules.map(rule => ({
      service: rule.consequent.find(item => item.startsWith('Service_')),
      confidence: rule.confidence
    })).sort((a, b) => b.confidence - a.confidence);
  }

  getProductPopularity(productName) {
    const searchTerms = this.generateSearchTerms(productName);
    let count = 0;
    
    for (let transaction of this.transactions) {
      if (searchTerms.some(term => 
        transaction.some(item => item.includes(term))
      )) {
        count++;
      }
    }
    
    return Math.min(count / this.transactions.length * 10, 5);
  }

  getFallbackRecommendations(allProducts, currentProduct, limit = 4) {
    const currentPrice = this.extractPrice(currentProduct.price);
    const currentCategory = currentProduct.category;
    const currentBrand = currentProduct.name.split(' ')[0];
    
    // Score each product based on similarity
    const scoredProducts = allProducts
      .filter(p => p.name !== currentProduct.name)
      .map(p => {
        let score = 0;
        const price = this.extractPrice(p.price);
        const priceDiff = Math.abs(price - currentPrice);
        
        // Category match (highest priority)
        if (p.category === currentCategory) score += 50;
        
        // Price similarity
        if (priceDiff < 5000) score += 30;
        else if (priceDiff < 15000) score += 20;
        else if (priceDiff < 30000) score += 10;
        
        // Brand diversity (prefer different brands)
        const productBrand = p.name.split(' ')[0];
        if (productBrand !== currentBrand) score += 15;
        
        // Popularity in transactions (if available)
        const popularity = this.getProductPopularity(p.name);
        score += popularity * 5;
        
        return { ...p, score, confidence: Math.min(score / 100, 0.9), isFallback: true };
      })
      .sort((a, b) => b.score - a.score);
    
    return scoredProducts.slice(0, limit);
  }

  extractPrice(priceStr) {
    if (typeof priceStr === 'number') return priceStr;
    const match = priceStr?.match(/(\d+[,.]?\d*)/);
    return match ? parseFloat(match[1].replace(',', '')) : 10000;
  }

  getStats() {
    const topRules = this.rules.slice(0, 10);
    const avgLift = topRules.length > 0
      ? (topRules.reduce((sum, r) => sum + r.lift, 0) / topRules.length).toFixed(2)
      : 0;
    
    return {
      totalTransactions: this.transactions.length,
      totalItemsets: this.frequentItemsets.length,
      totalRules: this.rules.length,
      avgConfidence: this.rules.length > 0 
        ? (this.rules.reduce((sum, r) => sum + r.confidence, 0) / this.rules.length).toFixed(2)
        : 0,
      avgLift: avgLift,
      strongRules: this.rules.filter(r => r.lift > 1.5 && r.confidence > 0.5).length
    };
  }
}

const recommender = new AprioriRecommender(0.1, 0.3);

const simulateMarketBasketTransactions = (count = 500) => {
  const transactions = [];
  const brands = ['Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes', 'Audi', 'Tesla', 'Nissan', 'Mazda', 'Chevrolet'];
  const phoneBrands = ['iPhone', 'Samsung', 'Google', 'Xiaomi', 'OnePlus', 'Oppo', 'Vivo', 'Realme'];
  const laptopBrands = ['MacBook', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Microsoft', 'MSI'];
  
  const buyerTypes = ['Individual', 'Dealer', 'Corporate'];
  const paymentMethods = ['Cash', 'Credit', 'Financing', 'Lease'];
  const locations = ['NewYork', 'California', 'Texas', 'Florida', 'Illinois'];
  const statuses = ['Completed', 'Pending', 'Negotiation'];
  
  const getPriceRange = (price) => {
    if (price < 10000) return 'Budget';
    if (price < 30000) return 'MidRange';
    if (price < 60000) return 'Premium';
    return 'Luxury';
  };

  const services = ['Insurance', 'Warranty', 'Financing', 'Delivery', 'Maintenance', 'Detailing'];

  // Create realistic co-occurrence patterns
  const patterns = [
    // Luxury car buyers tend to buy premium phones and laptops
    { primary: 'Price_Luxury', associated: ['Phone_iPhone', 'Laptop_MacBook'], weight: 0.7 },
    { primary: 'Price_Premium', associated: ['Phone_Samsung', 'Laptop_Dell'], weight: 0.6 },
    { primary: 'Price_Budget', associated: ['Phone_Xiaomi', 'Laptop_Lenovo'], weight: 0.5 },
    // Corporate buyers get more services
    { primary: 'BuyerType_Corporate', associated: ['Service_Insurance', 'Service_Warranty', 'Service_Maintenance'], weight: 0.8 },
    // Financing often comes with insurance
    { primary: 'Payment_Financing', associated: ['Service_Insurance', 'Service_Warranty'], weight: 0.65 },
  ];

  for (let i = 0; i < count; i++) {
    const basket = [];
    let priceRange;
    
    // Add product type (mix of cars, phones, laptops)
    const productType = Math.random();
    if (productType < 0.4) {
      // Car transaction
      const brand = brands[Math.floor(Math.random() * brands.length)];
      basket.push(`Car_${brand}`);
      basket.push(`Category_Car`);
      priceRange = getPriceRange(Math.random() * 70000 + 15000);
    } else if (productType < 0.7) {
      // Phone transaction
      const brand = phoneBrands[Math.floor(Math.random() * phoneBrands.length)];
      basket.push(`Phone_${brand}`);
      basket.push(`Category_Phone`);
      priceRange = getPriceRange(Math.random() * 1500 + 200);
    } else {
      // Laptop transaction
      const brand = laptopBrands[Math.floor(Math.random() * laptopBrands.length)];
      basket.push(`Laptop_${brand}`);
      basket.push(`Category_Laptop`);
      priceRange = getPriceRange(Math.random() * 3000 + 400);
    }

    // Add transaction details
    const buyerType = buyerTypes[Math.floor(Math.random() * buyerTypes.length)];
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    
    basket.push(`BuyerType_${buyerType}`);
    basket.push(`Payment_${paymentMethod}`);
    basket.push(`Location_${locations[Math.floor(Math.random() * locations.length)]}`);
    basket.push(`Status_${statuses[Math.floor(Math.random() * statuses.length)]}`);
    basket.push(`Price_${priceRange}`);

    // Apply pattern-based associations
    const applicablePatterns = patterns.filter(p => 
      basket.some(item => item.includes(p.primary)) && Math.random() < p.weight
    );
    
    for (let pattern of applicablePatterns) {
      pattern.associated.forEach(item => {
        if (Math.random() < 0.7 && !basket.includes(item)) {
          basket.push(item);
        }
      });
    }

    // Add services with realistic patterns
    let numServices = 1 + Math.floor(Math.random() * 2);
    if (buyerType === 'Corporate') numServices += 1;
    if (paymentMethod === 'Financing') numServices += 1;
    
    const selectedServices = [...services]
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(numServices, 4));
    
    selectedServices.forEach(service => {
      basket.push(`Service_${service}`);
    });

    transactions.push(basket);
  }

  return transactions;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [relatedServices, setRelatedServices] = useState([]);

  const [cars, setCars] = useState([]);
  const [phones, setPhones] = useState([]);
  const [laptops, setLaptops] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [loading, setLoading] = useState(false);

  const [transactionCount, setTransactionCount] = useState(0);
  const [algoStats, setAlgoStats] = useState({ totalRules: 0, avgConfidence: 0, avgLift: 0, strongRules: 0 });

  useEffect(() => {
    const marketBasketData = simulateMarketBasketTransactions(500);
    marketBasketData.forEach(t => recommender.addTransaction(t));
    
    recommender.findFrequentItemsets();
    recommender.generateRules();
    
    const stats = recommender.getStats();
    setTransactionCount(stats.totalTransactions);
    setAlgoStats({ 
      totalRules: stats.totalRules, 
      avgConfidence: stats.avgConfidence,
      avgLift: stats.avgLift,
      strongRules: stats.strongRules
    });
  }, []);

  const getPriceRange = (priceStr) => {
    if (typeof priceStr === 'number') return priceStr < 10000 ? 'Budget' : priceStr < 30000 ? 'MidRange' : priceStr < 60000 ? 'Premium' : 'Luxury';
    const match = priceStr?.match(/(\d+[,.]?\d*)/);
    const price = match ? parseFloat(match[1].replace(',', '')) : 10000;
    if (price < 10000) return 'Budget';
    if (price < 30000) return 'MidRange';
    if (price < 60000) return 'Premium';
    return 'Luxury';
  };

  const loadCarProducts = () => {
    setLoading(true);
    fetch("/data/coin_car.json")
      .then((res) => res.json())
      .then((data) => {
        const enhancedCars = data.map(car => ({
          ...car,
          category: 'car',
          attributes: [
            `Car_${car.brand || car.name.split(' ')[0]}`,
            `Category_Car`,
            `Location_${car.location?.replace('location_on', '').trim() || 'Unknown'}`,
            `Price_${getPriceRange(car.price)}`,
            `Status_Available`
          ]
        }));
        setCars(enhancedCars);
      })
      .catch(() => {
        const mockCars = [
          { name: "Toyota Camry 2023", price: "$25,000", image_url: "/images/car1.jpg", brand: "Toyota", location: "New York", category: 'car' },
          { name: "Honda Civic 2023", price: "$22,500", image_url: "/images/car2.jpg", brand: "Honda", location: "California", category: 'car' },
          { name: "Ford Mustang", price: "$35,000", image_url: "/images/car3.jpg", brand: "Ford", location: "Texas", category: 'car' },
          { name: "BMW X5", price: "$55,000", image_url: "/images/car4.jpg", brand: "BMW", location: "Florida", category: 'car' },
        ].map(car => ({
          ...car,
          attributes: [
            `Car_${car.brand}`,
            `Category_Car`,
            `Location_${car.location}`,
            `Price_${getPriceRange(car.price)}`,
            `Status_Available`
          ]
        }));
        setCars(mockCars);
      })
      .finally(() => setLoading(false));
  };

  const loadPhoneProducts = () => {
    const mockPhones = [
      { name: "iPhone 15 Pro", price: "$999", img: "/images/phone1.jpg", category: 'phone' },
      { name: "Samsung Galaxy S24", price: "$899", img: "/images/phone2.jpg", category: 'phone' },
      { name: "Google Pixel 8", price: "$699", img: "/images/phone3.jpg", category: 'phone' },
      { name: "OnePlus 12", price: "$799", img: "/images/phone4.jpg", category: 'phone' },
    ].map(phone => ({
      ...phone,
      attributes: [
        `Phone_${phone.name.split(' ')[0]}`,
        `Category_Phone`,
        `Price_${getPriceRange(phone.price)}`,
        `Status_Available`
      ]
    }));
    setPhones(mockPhones);
  };

  const loadLaptopProducts = () => {
    const mockLaptops = [
      { name: "MacBook Pro 16", price: "$2,499", img: "/images/laptop1.jpg", category: 'laptop' },
      { name: "Dell XPS 15", price: "$1,799", img: "/images/laptop2.jpg", category: 'laptop' },
      { name: "HP Spectre x360", price: "$1,399", img: "/images/laptop3.jpg", category: 'laptop' },
      { name: "Lenovo ThinkPad X1", price: "$1,599", img: "/images/laptop4.jpg", category: 'laptop' },
    ].map(laptop => ({
      ...laptop,
      attributes: [
        `Laptop_${laptop.name.split(' ')[0]}`,
        `Category_Laptop`,
        `Price_${getPriceRange(laptop.price)}`,
        `Status_Available`
      ]
    }));
    setLaptops(mockLaptops);
  };

  const loadAccessories = () => {
    const mockAccessories = [
      { name: "AirPods Pro", price: "$249", img: "/images/acc1.jpg", category: 'accessories' },
      { name: "Sony WH-1000XM5", price: "$399", img: "/images/acc2.jpg", category: 'accessories' },
      { name: "Apple Watch Series 9", price: "$399", img: "/images/acc3.jpg", category: 'accessories' },
      { name: "Samsung Galaxy Buds", price: "$149", img: "/images/acc4.jpg", category: 'accessories' },
    ];
    setAccessories(mockAccessories);
  };

  const handleCategorySelection = (category) => {
    setSelectedCategory(category);
    if (category === "Cars") loadCarProducts();
    else if (category === "Smartphones") loadPhoneProducts();
    else if (category === "Laptops") loadLaptopProducts();
    else if (category === "Accessories") loadAccessories();
  };

  const formatCars = (carList) => {
    return carList.map(car => ({
      name: car.name || "Unknown Car",
      price: car.price || "$0",
      img: car.image_url || "/images/placeholder.jpg",
      location: car.location || "Unknown",
      category: 'car',
      attributes: car.attributes
    }));
  };

  const productMap = {
    Cars: formatCars(cars),
    Smartphones: phones,
    Laptops: laptops,
    Accessories: accessories
  };

  const handleProductClick = (product) => {
    if (product.attributes) {
      const newTransaction = [...product.attributes];
      
      const services = ['Insurance', 'Warranty', 'Financing', 'Delivery'];
      const selectedServices = services.sort(() => 0.5 - Math.random()).slice(0, 2);
      selectedServices.forEach(service => {
        newTransaction.push(`Service_${service}`);
      });

      recommender.addTransaction(newTransaction);
      setTransactionCount(prev => prev + 1);
      
      recommender.findFrequentItemsets();
      recommender.generateRules();
      
      const stats = recommender.getStats();
      setAlgoStats({ 
        totalRules: stats.totalRules, 
        avgConfidence: stats.avgConfidence,
        avgLift: stats.avgLift,
        strongRules: stats.strongRules
      });
    }

    const recs = recommender.getRecommendations(product.name, 4);
    
    const allProducts = [
      ...productMap.Cars,
      ...productMap.Smartphones,
      ...productMap.Laptops,
      ...productMap.Accessories
    ];
    
    let mappedRecs = recs.map(rec => {
      const found = allProducts.find(p => {
        const productBrand = p.name.split(' ')[0];
        const recName = rec.name.toLowerCase().replace(/^(car|phone|laptop)_/i, '');
        const productWords = p.name.toLowerCase().split(' ');
        
        return rec.name.includes(productBrand) || 
               p.attributes?.some(attr => attr === rec.name) ||
               rec.name.includes(p.category) ||
               productWords.some(word => recName.includes(word) && word.length > 3) ||
               (p.category && rec.name.toLowerCase().includes(p.category));
      });
      return found ? { 
        ...found, 
        confidence: rec.confidence,
        lift: rec.lift,
        score: rec.totalScore 
      } : null;
    }).filter(Boolean);

    if (mappedRecs.length === 0) {
      mappedRecs = recommender.getFallbackRecommendations(allProducts, product, 4);
    }

    const services = recommender.getRelatedServices(product.name);
    setRelatedServices(services);

    setRecommendations(mappedRecs);
    setSelectedProduct(product);
  };

  const categories = [
    { name: "Cars", icon: Car, color: "from-blue-500 to-blue-600" },
    { name: "Smartphones", icon: Smartphone, color: "from-purple-500 to-purple-600" },
    { name: "Laptops", icon: Laptop, color: "from-green-500 to-green-600" },
    { name: "Accessories", icon: Headphones, color: "from-orange-500 to-orange-600" },
  ];

  return (
    <div className="min-h-screen w-full text-white bg-black">
      {/* Hero Section */}
      <div className="relative h-screen w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-black/60 to-blue-900/40" />
        
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
          <div className="mb-8 flex items-center gap-3">
            <ShoppingBag className="w-12 h-12 text-purple-400" />
            <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              ZARA&SILUE SHOP
            </h1>
          </div>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-12 text-center max-w-2xl">
            Exceptional Shopping Experience with Jumia and Coin Afrique Products
          </p>

          {/* Stats Display */}
          <div className="flex gap-6 mb-12 flex-wrap justify-center">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4">
              <div className="text-3xl font-bold text-purple-400">{transactionCount}</div>
              <div className="text-sm text-gray-300">Transactions</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4">
              <div className="text-3xl font-bold text-blue-400">{algoStats.totalRules}</div>
              <div className="text-sm text-gray-300">Association Rules</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4">
              <div className="text-3xl font-bold text-green-400">{algoStats.strongRules}</div>
              <div className="text-sm text-gray-300">Strong Rules</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4">
              <div className="text-3xl font-bold text-pink-400">{algoStats.avgLift}x</div>
              <div className="text-sm text-gray-300">Avg Lift</div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="w-full max-w-2xl mb-12">
            <div className="relative">
              <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
              <input
                type="text"
                placeholder="Search for products..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-16 pr-6 py-5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
              />
            </div>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => handleCategorySelection(cat.name)}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${cat.color} p-6 hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl`}
              >
                <cat.icon className="w-12 h-12 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-semibold">{cat.name}</h3>
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products View */}
      {selectedCategory && (
        <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black py-12 px-4">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className="flex items-center gap-2 text-gray-300 hover:text-white mb-8 transition"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Categories
            </button>

            <h2 className="text-4xl font-bold mb-8 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {selectedCategory}
            </h2>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {productMap[selectedCategory]?.map((product, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleProductClick(product)}
                    className="group cursor-pointer bg-white/5 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20"
                  >
                    <div className="relative h-48 overflow-hidden bg-gray-800">
                      <img
                        src={product.img}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                    <div className="p-6">
                      <h3 className="font-bold text-lg mb-2 text-white group-hover:text-purple-400 transition">
                        {product.name}
                      </h3>
                      <p className="text-2xl font-bold text-purple-400">{product.price}</p>
                      {product.location && (
                        <p className="text-sm text-gray-400 mt-2">{product.location}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Detail Modal with Recommendations */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Product Details</h2>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div className="rounded-2xl overflow-hidden bg-gray-100">
                  <img
                    src={selectedProduct.img}
                    alt={selectedProduct.name}
                    className="w-full h-80 object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-4">
                    {selectedProduct.name}
                  </h3>
                  <p className="text-4xl font-bold text-purple-600 mb-6">
                    {selectedProduct.price}
                  </p>
                  
                  {selectedProduct.location && (
                    <div className="flex items-center gap-2 text-gray-600 mb-4">
                      <Package className="w-5 h-5" />
                      <span>{selectedProduct.location}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-purple-50 rounded-xl p-4">
                      <Shield className="w-6 h-6 text-purple-600 mb-2" />
                      <p className="text-sm font-semibold text-gray-900">Secure Payment</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4">
                      <Package className="w-6 h-6 text-blue-600 mb-2" />
                      <p className="text-sm font-semibold text-gray-900">Fast Delivery</p>
                    </div>
                  </div>

                  <button className="w-full mt-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition flex items-center justify-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    Add to Cart
                  </button>
                </div>
              </div>

              {/* Related Services */}
              {relatedServices.length > 0 && (
                <div className="mb-12">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Recommended Services
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {relatedServices.slice(0, 4).map((service, i) => (
                      <div key={i} className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-200">
                        <CreditCard className="w-6 h-6 text-purple-600 mb-2" />
                        <p className="font-semibold text-gray-900 text-sm">
                          {service.service?.replace('Service_', '')}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {Math.round(service.confidence * 100)}% match
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations Section */}
              {recommendations.length > 0 ? (
                <div className="mt-12">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900">
                      Recommended For You
                    </h3>
                    <div className="text-right">
                      <span className="text-sm text-gray-500 block">
                        {recommendations[0]?.isFallback ? 
                          "Similar Products • Similarity Algorithm" : 
                          `Apriori Algorithm • ${algoStats.strongRules} strong rules`
                        }
                      </span>
                      {!recommendations[0]?.isFallback && (
                        <span className="text-xs text-gray-400">
                          Avg Lift: {algoStats.avgLift}x • Confidence: {(algoStats.avgConfidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className="rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition cursor-pointer bg-white"
                        onClick={() => handleProductClick(rec)}
                      >
                        <div className="relative">
                          <img
                            src={rec.img}
                            alt={rec.name}
                            className="w-full h-32 object-cover"
                          />
                          <div className={`absolute top-2 right-2 text-white text-xs px-2 py-1 rounded-full font-semibold ${
                            rec.isFallback ? 'bg-blue-500' : 
                            rec.confidence > 0.7 ? 'bg-green-500' :
                            rec.confidence > 0.5 ? 'bg-yellow-500' : 'bg-orange-500'
                          }`}>
                            {rec.isFallback ? 
                              `${Math.round(rec.confidence * 100)}% similar` : 
                              `${Math.round(rec.confidence * 100)}% match`
                            }
                          </div>
                          {!rec.isFallback && rec.lift && (
                            <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                              {rec.lift.toFixed(1)}x lift
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h4 className="font-semibold text-sm text-gray-900 line-clamp-2">
                            {rec.name}
                          </h4>
                          <p className="text-purple-600 font-bold mt-1 text-sm">{rec.price}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-12 text-center p-8 bg-gray-50 rounded-2xl">
                  <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">
                    Loading recommendations... The algorithm is analyzing patterns!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-black/50 backdrop-blur-md border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-400 mb-2">
            DailySmart helps you make smarter choices for your phones, cars,
                laptops, and accessories — with trusted recommendations.

          </p>
          <div className="flex justify-center gap-4 text-sm text-gray-500">
            <span>AI Class</span>
            <span>•</span>
            <span>Email: zara&silue@gmail.com</span>
            <span>•</span>
            <span>CSC</span>
          </div>
        </div>
      </footer>
    </div>
  );
}