import { auth } from "@/firebase/firebaseConfig";
import { DB } from "./DB";
import api from "@/api/whagonsApi";
import { Workspace } from "../Types";

export class WorkspaceCache {

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
            console.log("fetching workspaces, initialized: ", this.initialized);
            const success = await this.fetchWorkspaces();
            if (success) {
                this.initialized = true;
                this.lastUpdated = await this.getLastUpdated();
                console.log("workspaces fetched, initialized: ", this.initialized, "lastUpdated: ", this.lastUpdated);
            }
            return success;
        }else{
            //I must run a fetch to check if workspaces have changed   
            console.log("validating workspaces, lastUpdated: ", await this.getLastUpdated()); 
            return await this.validateWorkspaces();
        }
        
    }

    public static async deleteWorkspace(workspaceId: string) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("workspaces");
        store.delete(workspaceId);
    }

    public static async deleteWorkspaces() {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("workspaces");
        store.clear();
    }

    public static async updateWorkspace(id: string, workspace: Workspace) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("workspaces");
        //delete the old workspace
        store.delete(id);
        //add the new workspace
        store.put(workspace);
    }

    public static async addWorkspace(workspace: Workspace) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("workspaces");
        store.put(workspace);
    }

    public static async addWorkspaces(workspaces: Workspace[]) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("workspaces");
        workspaces.forEach(workspace => {
            store.put(workspace);
        });
    }

    public static async getWorkspace(workspaceId: string) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreRead("workspaces");
        const request = store.get(workspaceId);
        const workspace = await new Promise<Workspace>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return workspace;
    }

    public static async getWorkspaces() {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreRead("workspaces");
        const request = store.getAll();
        const workspaces = await new Promise<Workspace[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return workspaces;
    }

    public static async getLastUpdated(): Promise<Date> {
        const store = DB.getStoreRead("workspaces");
        const request = store.getAll();
        const workspaces = await new Promise<Workspace[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        //we need the most recent updated_at date
        const lastUpdated = workspaces.reduce((max, workspace) => {
            return new Date(workspace.updated_at) > max ? new Date(workspace.updated_at) : max;
        }, new Date(0));
        return lastUpdated; 
    }

    //set flag for intialized from local storage
    public static get initialized(): boolean {
        return localStorage.getItem(`workspaceCacheInitialized-${auth.currentUser?.uid}`) === "true";
    }
    public static set initialized(value: boolean) {
        localStorage.setItem(`workspaceCacheInitialized-${auth.currentUser?.uid}`, value.toString());
    }

    public static get lastUpdated(): Date {
        return new Date(localStorage.getItem(`workspaceCacheLastUpdated-${auth.currentUser?.uid}`) || "0");
    }
    public static set lastUpdated(value: Date) {
        localStorage.setItem(`workspaceCacheLastUpdated-${auth.currentUser?.uid}`, value.toISOString());
    }

    public static async fetchWorkspaces() {
        try {
            const response = await api.get("/workspaces");
            const workspaces = response.data.rows as Workspace[];
            console.log("workspaces", workspaces);
            this.addWorkspaces(workspaces);
            return true;
        } catch (error) {
            console.error("fetchWorkspaces", error);
            return false;
        }
    }

    public static async validateWorkspaces() {
        try {
            //we fetch only workspaces with a last_updated greater than the lastUpdated date
            const response = await api.get("/workspaces", {
                params: {
                    updated_after: this.lastUpdated.toISOString()
                }
            });
            const workspaces = response.data.rows as Workspace[];
            if (workspaces.length > 0) {
                this.addWorkspaces(workspaces);
            }
            return true;
        } catch (error) {
            console.error("validateWorkspaces", error);
            return false;
        }
    }

    
  }



  