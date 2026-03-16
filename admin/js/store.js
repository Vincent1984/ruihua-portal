// ================= State Management (Pinia) =================
// Using Pinia via CDN requires a Vue instance.
// We will create a hidden Vue app to host Pinia and expose stores to window.

const { createApp, ref, reactive } = Vue;
const { createPinia, defineStore } = Pinia;

// Define Stores
const useBannerStore = defineStore('banner', {
    state: () => ({
        data: {
            title: '',
            subTitle: '',
            desc: '',
            cta1: { text: '', link: '' },
            cta2: { text: '', link: '' },
            image: ''
        },
        loading: false
    }),
    actions: {
        async fetchConfig() {
            this.loading = true;
            try {
                const res = await fetch('/api/banner');
                const data = await res.json();
                this.data = data;
            } catch (err) {
                console.error('Failed to fetch banner', err);
            } finally {
                this.loading = false;
            }
        },
        async saveConfig(newData) {
            this.loading = true;
            try {
                const res = await fetch('/api/banner', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify(newData)
                });
                const result = await res.json();
                if(result.success) {
                    this.data = newData;
                    return true;
                }
                throw new Error(result.error);
            } finally {
                this.loading = false;
            }
        }
    }
});

// App Store for general state
const useAppStore = defineStore('app', {
    state: () => ({
        currentSection: 'dashboard',
        user: JSON.parse(sessionStorage.getItem('user') || '{}')
    }),
    actions: {
        setSection(section) {
            this.currentSection = section;
        }
    }
});

// Initialize Vue & Pinia
const pinia = createPinia();
const app = createApp({
    setup() {
        const bannerStore = useBannerStore();
        const appStore = useAppStore();
        
        // Expose to window for vanilla JS access
        window.bannerStore = bannerStore;
        window.appStore = appStore;
        
        return {};
    }
});

app.use(pinia);
// Mount to a hidden element
const mountPoint = document.createElement('div');
mountPoint.id = 'vue-mount-point';
mountPoint.style.display = 'none';
document.body.appendChild(mountPoint);
app.mount('#vue-mount-point');

console.log('Pinia Store Initialized');
