# Visual Tech Studio

A premium digital studio website built to showcase Visual Tech Studio's web development, graphic design, digital products, and selected projects.

## Live Website

[Visit Visual Tech Studio](https://ab-black.github.io/visualtechstudio/index.html)

## About

Visual Tech Studio is a modern digital studio focused on creating polished websites, web applications, visual designs, and digital products for businesses, organizations, startups, and personal brands.

The website is designed as both a studio portfolio and a functional digital platform, with customer authentication, a product store, checkout, customer accounts, and a private digital library.

## Main Features

- Premium responsive website design
- Studio / About section
- Project showcase and portfolio
- Services presentation
- Digital product store
- Product details and Read More views
- Customer account authentication
- Customer My Account dashboard
- My Library for purchased digital products
- Secure product downloads
- Checkout and payment integration
- Contact / project request form
- Responsive desktop and mobile layouts
- Shared authentication navigation

## Website Structure

| Section | Purpose |
| --- | --- |
| Home | Introduction, branding, services and featured work |
| Studio | Information about Visual Tech Studio, approach and values |
| Services | Overview of available services |
| Work | Portfolio and selected projects |
| Store | Digital products and purchasing |
| Account | Sign in, account creation and password recovery |
| My Account | Customer account dashboard |
| My Library | Purchased digital products and secure downloads |
| Contact | Project enquiries and service requests |
| Checkout | Product purchase and payment flow |

## Technology

- HTML5
- CSS3
- JavaScript
- Supabase
- Paystack
- GitHub
- GitHub Pages

## Backend

Supabase is used for application data and customer functionality, including:

- Authentication
- Products
- Product files
- Orders
- Customer product access
- Service requests
- Secure product downloads

Private product files are protected and accessed through authenticated download functionality rather than exposing permanent public file URLs.

## Payments

The store uses Paystack for digital product payments.

The checkout flow includes:

1. Customer selects a product.
2. Customer signs in or creates an account.
3. A pending order is created.
4. Payment is initialized with Paystack.
5. Payment is verified.
6. The order is finalized.
7. Purchased product access is associated with the customer's account.
8. The product becomes available in My Library.

## Project Goals

The project combines a professional portfolio with a functional customer-facing digital product platform. The goal is to provide a polished experience while keeping the architecture suitable for future expansion.

## Development

The frontend is hosted through GitHub Pages, while Supabase provides the backend services.

Changes are developed and committed through GitHub. The main branch is used for the deployed site.

## Author

**Abraham Gift**

Web Developer & Graphic Designer

Visual Tech Studio
