import { createSlice } from "@reduxjs/toolkit";


const initialState = {
    value: 0
}


export const pizzaSlice = createSlice({
    name: 'pizza',
    initialState,
    reducers: {
        addPizza: (state) => {
            state.value += 1
        },
        removePizza: (state) => {
            state.value -= 1
        }
    }
})

