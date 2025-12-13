import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    total: 0,
    products: [],
    totalPrice: 0
}

export const cartSlice = createSlice({
    name: 'cart',
    initialState,
    reducers: {
        updateTotal: (state, action) => {
            state.total = action.payload;
        },
        clearCart: (state) => {
            state.products = [];
            state.total = 0;
            state.totalPrice = 0;
        }
    }
})

// Action creators...
export const { updateTotal, clearCart } = cartSlice.actions;

export default cartSlice.reducer;