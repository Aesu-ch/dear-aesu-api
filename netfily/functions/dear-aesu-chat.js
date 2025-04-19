// Chat history for context 
let chatHistory = [];
  
// Function to generate AI response using Claude API
async function generateResponse(userInput) {
  try {
    // Extract potential skin type and concerns from user input
    const input = userInput.toLowerCase();
    let skinType = "";
    let concerns = [];
    
    // Simple detection logic to help Claude
    if (input.includes("dry")) skinType = "dry";
    else if (input.includes("oily")) skinType = "oily";
    else if (input.includes("combination")) skinType = "combination";
    else if (input.includes("normal")) skinType = "normal";
    else if (input.includes("sensitive")) skinType = "sensitive";
    
    if (input.includes("acne") || input.includes("pimple") || input.includes("breakout") || input.includes("blemish")) 
      concerns.push("acne");
    if (input.includes("dark spot") || input.includes("pigment") || input.includes("uneven") || input.includes("melasma"))
      concerns.push("hyperpigmentation");
    if (input.includes("wrinkle") || input.includes("fine line") || input.includes("aging") || input.includes("mature"))
      concerns.push("aging");
    if (input.includes("redness") || input.includes("irritat") || input.includes("calm") || input.includes("sooth"))
      concerns.push("sensitivity");
    if (input.includes("pore") || input.includes("blackhead") || input.includes("congestion"))
      concerns.push("congestion");
    if (input.includes("dry") || input.includes("dehydrat") || input.includes("flaky") || input.includes("tight"))
      concerns.push("dryness");
      
    // Make API request to our Claude serverless function
    const response = await fetch('https://your-netlify-site.netlify.app/.netlify/functions/dear-aesu-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userInput,
        history: chatHistory,
        skinType: skinType,
        skinConcerns: concerns
      })
    });
    
    if (!response.ok) {
      throw new Error('AI service error');
    }
    
    const data = await response.json();
    
    // Add messages to history for context in future requests
    chatHistory.push({ role: "user", content: userInput });
    chatHistory.push({ role: "assistant", content: data.message });
    
    // Keep history limited to last 10 messages to avoid token limits
    if (chatHistory.length > 10) {
      chatHistory = chatHistory.slice(chatHistory.length - 10);
    }
    
    // Process the response to add product cards
    return processAIResponseWithProducts(data.message);
    
  } catch (error) {
    console.error('Error generating AI response:', error);
    
    // Fallback to a simple response if the AI service fails
    return "I'm sorry, I'm having trouble connecting to my knowledge base right now. Could you please try again in a moment?";
  }
}

// Function to process Claude's response and add product cards
function processAIResponseWithProducts(response) {
  // Look for product recommendation tags that Claude will generate
  const productPattern = /<product>([\s\S]*?)<\/product>/g;
  const productMatches = [...response.matchAll(productPattern)];
  
  // If no product tags found, return the response as is
  if (productMatches.length === 0) {
    return response;
  }
  
  // Otherwise, replace product tags with product cards
  let processedResponse = response;
  
  for (const match of productMatches) {
    const productHtml = match[0]; // The full product tag
    const productContent = match[1]; // The content inside the tags
    
    // Extract product details
    const nameMatch = /<n>(.*?)<\/n>/s.exec(productContent);
    const descMatch = /<description>(.*?)<\/description>/s.exec(productContent);
    const ingredientsMatch = /<key_ingredients>(.*?)<\/key_ingredients>/s.exec(productContent);
    const skinTypesMatch = /<skin_types>(.*?)<\/skin_types>/s.exec(productContent);
    const priceMatch = /<price>(.*?)<\/price>/s.exec(productContent);
    
    const productName = nameMatch ? nameMatch[1] : "Recommended Product";
    const productDesc = descMatch ? descMatch[1] : "";
    const productPrice = priceMatch ? priceMatch[1] : "$0.00";
    
    // Find matching products in our catalog
    const matchingProducts = findMatchingProducts(productName);
    let productCard;
    
    if (matchingProducts.length > 0) {
      // Use actual product from catalog
      productCard = createProductCard(matchingProducts[0]);
    } else {
      // Create a generic product card with Claude's recommendation
      productCard = `
        <div class="aesu-product">
          <div class="aesu-product-image">
            <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png" alt="${productName}">
          </div>
          <div class="aesu-product-info">
            <div class="aesu-product-name">${productName}</div>
            <div class="aesu-product-price">${productPrice}</div>
            <div class="aesu-product-description">${productDesc}</div>
          </div>
          <button class="aesu-add-to-cart" disabled>Not In Stock</button>
        </div>
      `;
    }
    
    // Replace the product tag with the product card
    processedResponse = processedResponse.replace(productHtml, productCard);
  }
  
  return processedResponse;
}

// Function to find matching products in our catalog
function findMatchingProducts(productName) {
  // Normalize the name for better matching
  const normalizedName = productName.toLowerCase();
  const matchingProducts = [];
  
  // Check all concerns for matching products
  for (const concern in skincareKnowledge) {
    if (skincareKnowledge[concern].products && skincareKnowledge[concern].products.length > 0) {
      const products = skincareKnowledge[concern].products;
      
      for (const product of products) {
        // Check if product name contains the recommended product name or vice versa
        if (product.name.toLowerCase().includes(normalizedName) || 
            normalizedName.includes(product.name.toLowerCase())) {
          matchingProducts.push(product);
        }
      }
    }
  }
  
  // Also check for products directly in shopifyProducts
  if (shopifyProducts && shopifyProducts.length > 0) {
    for (const product of shopifyProducts) {
      if (product.title.toLowerCase().includes(normalizedName) ||
          normalizedName.includes(product.title.toLowerCase())) {
        // Convert Shopify product to our format
        matchingProducts.push({
          id: product.id,
          handle: product.handle,
          name: product.title,
          price: product.variants && product.variants.length > 0 ? formatPrice(product.variants[0].price) : "$0.00",
          description: product.body_html ? product.body_html.substring(0, 80) + "..." : "",
          image: product.images && product.images.length > 0 ? product.images[0].src : ""
        });
      }
    }
  }
  
  return matchingProducts;
}
