# StockMaster Pro

A web-based inventory management system built with **plain HTML, CSS, and JavaScript** (no frameworks or styling libraries). It lets you keep track of products, stock movements, and purchase and sales orders from a simple dashboard.

## Overview

The main panel (Dashboard) shows at a glance:

- **Total products** recorded (SKUs).
- **Inventory value** (price × quantity).
- **Products that need restocking** (below the minimum threshold).
- **Out-of-stock products**.
- **Recent activity** and **critical stock**.
- **Stock levels chart** (top 8 products).

## Sections

| Section | Description |
|---|---|
| Dashboard | General inventory summary with indicators and a chart. |
| Products | Add, edit, and delete products, with search and sorting. |
| Movements | History of stock in, stock out, adjustments, and returns. |
| Purchase Order | Purchase orders to suppliers. |
| Sales Orders | Sales orders to customers. |

## Features

- Add, edit, and delete products.
- Adjust quantities with + and − buttons.
- Set a minimum stock threshold per product.
- Status indicators: normal stock (green), low stock (yellow), and out of stock (red).
- Search and sorting in tables.
- Data export to **CSV**.
- Toast notifications for user actions.
- Responsive design with a hamburger menu for small screens.

## Technologies

- **HTML5** for structure.
- **CSS3** (Flexbox and Grid) for layout, using a light theme written in plain CSS.
- **JavaScript** for the application logic.

## Project Structure

```
stockmaster-pro/
├── index.html      # Page structure
├── styles.css      # Styles
├── script.js       # Application logic
└── README.md       # This file
```

> Adjust the file names to match how your project is organized.

## How to Run

1. Download or clone the project:
   ```bash
   git clone https://github.com/your-username/stockmaster-pro.git
   ```
2. Open the project folder.
3. Open `index.html` in your browser (double-click it or use the *Live Server* extension in VS Code).

No installation or server needed, just a modern browser.

## Color Palette

| Use | Color |
|---|---|
| Page background | `#cfcfcf75` |
| Sidebar and cards | `#ffffff` |
| Main accent | `#0056b3` |
| Healthy stock | `#28a745` |
| Low stock | `#ffc107` |
| Out of stock | `#dc3545` |


## Author

**Migueldevx**