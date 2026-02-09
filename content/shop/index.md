---
title: Shop
Short-URI: shop
Template: shop
Type: page
Category: Shop
Order: 5
Labels:
  - shop
  - htmx
Parent: root
Author: System
Date: 2024-02-01
Description: Browse our products
Keywords:
  - shop
  - products
  - cart
---

# Shop

Browse our products below. Click any product for details, or add straight to your cart.

:::children sort=order type=product class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6"
<article class="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
  <a href="{url}" class="block">
    <div class="w-full h-48 bg-gray-50 flex items-center justify-center">
      <span class="text-6xl">{image}</span>
    </div>
    <div class="p-5">
      <h3 class="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p class="text-sm text-gray-500 mb-3 line-clamp-2">{description}</p>
    </div>
  </a>
  <div class="px-5 pb-5 flex items-center justify-between">
    <span class="text-xl font-bold text-gray-900">{price}</span>
    <button
      class="flint-add-to-cart bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      data-id="{short-uri}"
      data-qty="1"
      aria-label="Add {title} to cart"
    >Add to Cart</button>
  </div>
</article>
:::
