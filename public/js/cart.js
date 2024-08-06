document.addEventListener('DOMContentLoaded', () => {
    const cart = [];
    const cartItemsContainer = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total');

    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent the default link behavior

            const name = button.getAttribute('data-name');
            const price = parseFloat(button.getAttribute('data-price'));
            const description = button.getAttribute('data-description');

            const existingItem = cart.find(item => item.name === name);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                cart.push({ name, price, description, quantity: 1 });
            }

            updateCart();
        });
    });

    function updateCart() {
        cartItemsContainer.innerHTML = '';
        let total = 0;
        let itemCount = 0;

        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            itemCount += item.quantity;

            const listItem = document.createElement('li');
            listItem.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'lh-sm');
            listItem.innerHTML = `
                <div>
                    <h6 class="my-0">${item.name}</h6>
                    <small class="text-body-secondary">${item.description}</small>
                </div>
                <span class="text-body-secondary">$${itemTotal.toFixed(2)}</span>
            `;

            cartItemsContainer.appendChild(listItem);
        });

        cartCount.textContent = itemCount;
        cartTotal.textContent = `$${total.toFixed(2)}`;
    }
});
