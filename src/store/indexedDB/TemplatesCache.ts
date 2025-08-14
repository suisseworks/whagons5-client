import { Template } from "../types";
import { DB } from "./DB";

type TemplateCache = Template[];

export class TemplatesCache {
    private static CACHE_NAME = 'templates';
    private static cache: TemplateCache = [];

    static async init(): Promise<void> {
        try {
            const cachedTemplates = await DB.getAll(this.CACHE_NAME);
            this.cache = cachedTemplates || [];
            console.log(`TemplatesCache initialized with ${this.cache.length} templates`);
        } catch (error) {
            console.error('Failed to initialize TemplatesCache:', error);
            this.cache = [];
        }
    }

    static async getTemplates(): Promise<TemplateCache> {
        return [...this.cache];
    }

    static async getTemplate(id: string): Promise<Template | null> {
        const template = this.cache.find(t => t.id.toString() === id);
        return template || null;
    }

    static async addTemplate(template: Template): Promise<void> {
        try {
            // Add to IndexedDB
            await DB.add(this.CACHE_NAME, template);
            
            // Update cache
            const existingIndex = this.cache.findIndex(t => t.id === template.id);
            if (existingIndex !== -1) {
                this.cache[existingIndex] = template;
            } else {
                this.cache.push(template);
            }
            
            console.log(`Template ${template.id} added to cache`);
        } catch (error) {
            console.error('Failed to add template to cache:', error);
            throw error;
        }
    }

    static async updateTemplate(id: string, updatedTemplate: Template): Promise<void> {
        try {
            // Update in IndexedDB
            await DB.update(this.CACHE_NAME, parseInt(id), updatedTemplate);
            
            // Update cache
            const index = this.cache.findIndex(t => t.id.toString() === id);
            if (index !== -1) {
                this.cache[index] = updatedTemplate;
                console.log(`Template ${id} updated in cache`);
            } else {
                console.warn(`Template ${id} not found in cache for update`);
            }
        } catch (error) {
            console.error('Failed to update template in cache:', error);
            throw error;
        }
    }

    static async deleteTemplate(id: string): Promise<void> {
        try {
            // Remove from IndexedDB
            await DB.delete(this.CACHE_NAME, parseInt(id));
            
            // Remove from cache
            this.cache = this.cache.filter(t => t.id.toString() !== id);
            
            console.log(`Template ${id} deleted from cache`);
        } catch (error) {
            console.error('Failed to delete template from cache:', error);
            throw error;
        }
    }

    static async clearCache(): Promise<void> {
        try {
            await DB.clear(this.CACHE_NAME);
            this.cache = [];
            console.log('Templates cache cleared');
        } catch (error) {
            console.error('Failed to clear templates cache:', error);
            throw error;
        }
    }

    static async syncWithServer(templates: Template[]): Promise<void> {
        try {
            // Clear existing data
            await this.clearCache();
            
            // Add all templates to IndexedDB
            for (const template of templates) {
                await DB.add(this.CACHE_NAME, template);
            }
            
            // Update cache
            this.cache = [...templates];
            
            console.log(`Templates cache synced with ${templates.length} templates`);
        } catch (error) {
            console.error('Failed to sync templates cache with server:', error);
            throw error;
        }
    }

    static getCacheStats() {
        return {
            count: this.cache.length,
            lastUpdated: new Date().toISOString()
        };
    }

    // Helper method to get templates by category
    static async getTemplatesByCategory(categoryId: number): Promise<Template[]> {
        return this.cache.filter(template => template.category_id === categoryId);
    }

    // Helper method to get templates by team
    static async getTemplatesByTeam(teamId: number): Promise<Template[]> {
        return this.cache.filter(template => template.team_id === teamId);
    }

    // Helper method to get enabled templates only
    static async getEnabledTemplates(): Promise<Template[]> {
        return this.cache.filter(template => template.enabled);
    }
}

