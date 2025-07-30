import { auth } from "@/firebase/firebaseConfig";
import { Team } from "../Types";
import { DB } from "./DB";
import api from "@/api/whagonsApi";

export class TeamsCache {

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
            console.log("fetching teams, initialized: ", this.initialized);
            const success = await this.fetchTeams();
            if (success) {
                this.initialized = true;
                this.lastUpdated = await this.getLastUpdated();
                console.log("teams fetched, initialized: ", this.initialized, "lastUpdated: ", this.lastUpdated);
            }
            return success;
        } else {
            //I must run a fetch to check if teams have changed   
            console.log("validating teams, lastUpdated: ", await this.getLastUpdated()); 
            return await this.validateTeams();
        }
    }

    public static async deleteTeam(teamId: string) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("teams");
        store.delete(teamId);
    }

    public static async deleteTeams() {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("teams");
        store.clear();
    }

    public static async updateTeam(id: string, team: Team) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("teams");
        //delete the old team
        store.delete(id);
        //add the new team
        store.put(team);
    }

    public static async addTeam(team: Team) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("teams");
        store.put(team);
    }

    public static async addTeams(teams: Team[]) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("teams");
        teams.forEach(team => {
            store.put(team);
        });
    }

    public static async getTeam(teamId: string) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreRead("teams");
        const request = store.get(teamId);
        const team = await new Promise<Team>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return team;
    }

    public static async getTeams() {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreRead("teams");
        const request = store.getAll();
        const teams = await new Promise<Team[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return teams;
    }

    public static async getLastUpdated(): Promise<Date> {
        const store = DB.getStoreRead("teams");
        const request = store.getAll();
        const teams = await new Promise<Team[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        //we need the most recent updated_at date
        const lastUpdated = teams.reduce((max, team) => {
            return new Date(team.updated_at) > max ? new Date(team.updated_at) : max;
        }, new Date(0));
        return lastUpdated; 
    }

    //set flag for initialized from local storage
    public static get initialized(): boolean {
        return localStorage.getItem(`teamsCacheInitialized-${auth.currentUser?.uid}`) === "true";
    }
    public static set initialized(value: boolean) {
        localStorage.setItem(`teamsCacheInitialized-${auth.currentUser?.uid}`, value.toString());
    }

    public static get lastUpdated(): Date {
        return new Date(localStorage.getItem(`teamsCacheLastUpdated-${auth.currentUser?.uid}`) || "0");
    }
    public static set lastUpdated(value: Date) {
        localStorage.setItem(`teamsCacheLastUpdated-${auth.currentUser?.uid}`, value.toISOString());
    }

    public static async fetchTeams() {
        try {
            const response = await api.get("/teams");
            const rawTeams = response.data.rows;
            console.log("raw teams", rawTeams);
            
            // Transform snake_case API response to camelCase format
            const teams: Team[] = rawTeams.map((team: any) => ({
                ...team,
                created_at: team.created_at,
                updated_at: team.updated_at
            }));
            
            console.log("transformed teams", teams);
            this.addTeams(teams);
            return true;
        } catch (error) {
            console.error("fetchTeams", error);
            return false;
        }
    }

    public static async validateTeams() {
        try {
            //we fetch only teams with a last_updated greater than the lastUpdated date
            const response = await api.get("/teams", {
                params: {
                    updated_after: this.lastUpdated.toISOString()
                }
            });
            const rawTeams = response.data.rows;
            console.log("raw teams", rawTeams);
            
            // Transform snake_case API response to camelCase format
            const teams: Team[] = rawTeams.map((team: any) => ({
                ...team,
                created_at: team.created_at,
                updated_at: team.updated_at
            }));
            
            if (teams.length > 0) {
                this.addTeams(teams);
            }
            return true;
        } catch (error) {
            console.error("validateTeams", error);
            return false;
        }
    }
} 