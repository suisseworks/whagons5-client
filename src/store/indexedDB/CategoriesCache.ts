import { auth } from "@/firebase/firebaseConfig";
import { Category } from "../types";
import { DB } from "./DB";
import api from "@/api/whagonsApi";

export class CategoriesCache {

    private static initPromise: Promise<boolean> | null = null;
    private static authListener: (() => void) | null = null;

    public static async init(): Promise<boolean> {
        // Prevent multiple simultaneous initializations
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._doInit();
        try {
            return await this.initPromise;
        } finally {
            this.initPromise = null;
        }
    }

    private static async _doInit(): Promise<boolean> {
        await DB.init();
        
        if (!auth.currentUser) {
            return new Promise((resolve) => {
                // Clean up any existing listener
                if (this.authListener) {
                    this.authListener();
                }

                this.authListener = auth.onAuthStateChanged(async (user) => {
                    if (user) {
                        this.authListener?.();
                        this.authListener = null;
                        try {
                            const result = await this._doInit();
                            resolve(result);
                        } catch (error) {
                            console.error('Error during delayed initialization:', error);
                            resolve(false);
                        }
                    } else {
                        this.authListener?.();
                        this.authListener = null;
                        resolve(false);
                    }
                });
            });
        }

        if (!this.initialized) {
            console.log("fetching categories, initialized: ", this.initialized);
            const success = await this.fetchCategories();
            if (success) {
                this.initialized = true;
                this.lastUpdated = await this.getLastUpdated();
                console.log("categories fetched, initialized: ", this.initialized, "lastUpdated: ", this.lastUpdated);
            }
            return success;
        } else {
            //I must run a fetch to check if categories have changed   
            console.log("validating categories, lastUpdated: ", await this.getLastUpdated()); 
            return await this.validateCategories();
        }
    }

    public static async deleteCategory(categoryId: string) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("categories");
        store.delete(categoryId);
    }

    public static async deleteCategories() {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("categories");
        store.clear();
    }

    public static async updateCategory(id: string, category: Category) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("categories");
        //delete the old category
        store.delete(id);
        //add the new category
        store.put(category);
    }

    public static async addCategory(category: Category) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("categories");
        store.put(category);
    }

    public static async addCategories(categories: Category[]) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("categories");
        categories.forEach(category => {
            store.put(category);
        });
    }

    public static async getCategory(categoryId: string) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreRead("categories");
        const request = store.get(categoryId);
        const category = await new Promise<Category>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return category;
    }

    public static async getCategories() {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreRead("categories");
        const request = store.getAll();
        const categories = await new Promise<Category[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return categories;
    }

    public static async getLastUpdated(): Promise<Date> {
        const store = DB.getStoreRead("categories");
        const request = store.getAll();
        const categories = await new Promise<Category[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        //we need the most recent updated_at date
        const lastUpdated = categories.reduce((max, category) => {
            return new Date(category.updated_at) > max ? new Date(category.updated_at) : max;
        }, new Date(0));
        return lastUpdated; 
    }

    //set flag for initialized from local storage
    public static get initialized(): boolean {
        return localStorage.getItem(`categoriesCacheInitialized-${auth.currentUser?.uid}`) === "true";
    }
    public static set initialized(value: boolean) {
        localStorage.setItem(`categoriesCacheInitialized-${auth.currentUser?.uid}`, value.toString());
    }

    public static get lastUpdated(): Date {
        return new Date(localStorage.getItem(`categoriesCacheLastUpdated-${auth.currentUser?.uid}`) || "0");
    }
    public static set lastUpdated(value: Date) {
        localStorage.setItem(`categoriesCacheLastUpdated-${auth.currentUser?.uid}`, value.toISOString());
    }

    public static async fetchCategories() {
        try {
            const response = await api.get("/categories");
            const categories = response.data.rows as Category[];
            console.log("categories", categories);
            this.addCategories(categories);
            return true;
        } catch (error) {
            console.error("fetchCategories", error);
            return false;
        }
    }

    public static async createCategory(categoryData: Omit<Category, 'id' | 'created_at' | 'updated_at'>) {
        try {
            const response = await api.post("/categories", categoryData);
            const newCategory = response.data as Category;
            console.log("category created", newCategory);
            this.addCategory(newCategory);
            return newCategory;
        } catch (error) {
            console.error("createCategory", error);
            throw error;
        }
    }

    public static async validateCategories() {
        try {
            //we fetch only categories with a last_updated greater than the lastUpdated date
            const response = await api.get("/categories", {
                params: {
                    updated_after: this.lastUpdated.toISOString()
                }
            });
            const categories = response.data.rows as Category[];
            if (categories.length > 0) {
                this.addCategories(categories);
            }
            return true;
        } catch (error) {
            console.error("validateCategories", error);
            return false;
        }
    }
} 