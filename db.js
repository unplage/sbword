// 数据库配置
const DB_NAME = 'WordLearnerDB';
const DB_VERSION = 1;

// 对象存储名称
const STORES = {
    WORDS: 'words',
    USER_PROGRESS: 'user_progress',
    NEW_WORDS: 'new_words',
    DAILY_PLAN: 'daily_plan',
    LEARNING_HISTORY: 'learning_history',
    NOVELS: 'novels',
    SETTINGS: 'settings'
};

class WordDatabase {
    constructor() {
        this.db = null;
        this.initPromise = this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 创建单词表
                if (!db.objectStoreNames.contains(STORES.WORDS)) {
                    const wordsStore = db.createObjectStore(STORES.WORDS, { keyPath: 'id', autoIncrement: true });
                    wordsStore.createIndex('word', 'word', { unique: true });
                    wordsStore.createIndex('difficulty', 'difficulty');
                    wordsStore.createIndex('source', 'source');
                    wordsStore.createIndex('lastReviewed', 'lastReviewed');
                }
                
                // 用户进度表
                if (!db.objectStoreNames.contains(STORES.USER_PROGRESS)) {
                    const progressStore = db.createObjectStore(STORES.USER_PROGRESS, { keyPath: 'wordId' });
                    progressStore.createIndex('nextReview', 'nextReview');
                    progressStore.createIndex('familiarity', 'familiarity');
                }
                
                // 生词本
                if (!db.objectStoreNames.contains(STORES.NEW_WORDS)) {
                    db.createObjectStore(STORES.NEW_WORDS, { keyPath: 'wordId' });
                }
                
                // 每日计划
                if (!db.objectStoreNames.contains(STORES.DAILY_PLAN)) {
                    db.createObjectStore(STORES.DAILY_PLAN, { keyPath: 'id' });
                }
                
                // 学习历史
                if (!db.objectStoreNames.contains(STORES.LEARNING_HISTORY)) {
                    const historyStore = db.createObjectStore(STORES.LEARNING_HISTORY, { keyPath: 'id', autoIncrement: true });
                    historyStore.createIndex('date', 'date');
                    historyStore.createIndex('wordId', 'wordId');
                }
                
                // 小说记录
                if (!db.objectStoreNames.contains(STORES.NOVELS)) {
                    const novelsStore = db.createObjectStore(STORES.NOVELS, { keyPath: 'id', autoIncrement: true });
                    novelsStore.createIndex('title', 'title');
                }
                
                // 设置
                if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                    db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
                }
            };
        });
    }

    async ready() {
        return this.initPromise;
    }

    // 单词操作
    async addWord(wordData) {
        await this.ready();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.WORDS], 'readwrite');
            const store = transaction.objectStore(STORES.WORDS);
            const request = store.add({
                ...wordData,
                createdAt: new Date().toISOString(),
                lastReviewed: null,
                reviewCount: 0
            });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getWord(word) {
        await this.ready();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.WORDS], 'readonly');
            const store = transaction.objectStore(STORES.WORDS);
            const index = store.index('word');
            const request = index.get(word);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllWords(filter = {}) {
        await this.ready();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.WORDS], 'readonly');
            const store = transaction.objectStore(STORES.WORDS);
            const request = store.getAll();
            
            request.onsuccess = () => {
                let words = request.result;
                
                // 应用过滤器
                if (filter.difficulty && filter.difficulty !== 'all') {
                    words = words.filter(w => w.difficulty == filter.difficulty);
                }
                
                if (filter.source && filter.source !== 'all') {
                    words = words.filter(w => w.source === filter.source);
                }
                
                if (filter.search) {
                    const searchTerm = filter.search.toLowerCase();
                    words = words.filter(w => 
                        w.word.toLowerCase().includes(searchTerm) ||
                        w.meaning.toLowerCase().includes(searchTerm)
                    );
                }
                
                resolve(words);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // 用户进度操作
    async updateProgress(wordId, correct) {
        await this.ready();
        
        // 获取当前进度
        const progress = await this.getProgress(wordId);
        const word = await this.getWordById(wordId);
        
        if (!word) return;
        
        // 更新SM-2间隔重复算法
        const now = new Date();
        let nextInterval;
        let familiarity = progress ? progress.familiarity : 0;
        
        if (correct) {
            familiarity = Math.min(familiarity + 1, 5);
            
            // 基于熟悉度的间隔
            const intervals = [1, 3, 7, 14, 30]; // 天数
            nextInterval = intervals[Math.min(familiarity, intervals.length - 1)];
        } else {
            familiarity = Math.max(familiarity - 1, 0);
            nextInterval = 1; // 明天复习
        }
        
        const nextReview = new Date(now);
        nextReview.setDate(nextReview.getDate() + nextInterval);
        
        const progressData = {
            wordId,
            familiarity,
            nextReview: nextReview.toISOString(),
            lastReview: now.toISOString(),
            totalReviews: (progress?.totalReviews || 0) + 1
        };
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.USER_PROGRESS], 'readwrite');
            const store = transaction.objectStore(STORES.USER_PROGRESS);
            const request = store.put(progressData);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getProgress(wordId) {
        await this.ready();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.USER_PROGRESS], 'readonly');
            const store = transaction.objectStore(STORES.USER_PROGRESS);
            const request = store.get(wordId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 生词本操作
    async addToNewWords(wordId) {
        await this.ready();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.NEW_WORDS], 'readwrite');
            const store = transaction.objectStore(STORES.NEW_WORDS);
            const request = store.put({
                wordId,
                addedAt: new Date().toISOString()
            });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async removeFromNewWords(wordId) {
        await this.ready();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.NEW_WORDS], 'readwrite');
            const store = transaction.objectStore(STORES.NEW_WORDS);
            const request = store.delete(wordId);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getNewWords() {
        await this.ready();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.NEW_WORDS, STORES.WORDS], 'readonly');
            const newWordsStore = transaction.objectStore(STORES.NEW_WORDS);
            const wordsStore = transaction.objectStore(STORES.WORDS);
            
            const request = newWordsStore.getAll();
            
            request.onsuccess = async () => {
                const newWords = request.result;
                const wordDetails = [];
                
                for (const newWord of newWords) {
                    const wordRequest = wordsStore.get(newWord.wordId);
                    wordRequest.onsuccess = () => {
                        if (wordRequest.result) {
                            wordDetails.push({
                                ...wordRequest.result,
                                addedAt: newWord.addedAt
                            });
                        }
                    };
                }
                
                // 等待所有查询完成
                transaction.oncomplete = () => resolve(wordDetails);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // 每日计划操作
    async saveDailyPlan(plan) {
        await this.ready();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.DAILY_PLAN], 'readwrite');
            const store = transaction.objectStore(STORES.DAILY_PLAN);
            const request = store.put({
                id: 1,
                ...plan,
                updatedAt: new Date().toISOString()
            });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getDailyPlan() {
        await this.ready();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.DAILY_PLAN], 'readonly');
            const store = transaction.objectStore(STORES.DAILY_PLAN);
            const request = store.get(1);
            
            request.onsuccess = () => resolve(request.result || {
                dailyGoal: 20,
                reviewGoal: 50,
                studyTime: 'any',
                notifications: false
            });
            request.onerror = () => reject(request.error);
        });
    }

    // 学习历史
    async addLearningHistory(wordId, correct) {
        await this.ready();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.LEARNING_HISTORY], 'readwrite');
            const store = transaction.objectStore(STORES.LEARNING_HISTORY);
            const request = store.add({
                wordId,
                date: new Date().toISOString(),
                correct
            });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getTodayHistory() {
        await this.ready();
        const today = new Date().toISOString().split('T')[0];
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.LEARNING_HISTORY], 'readonly');
            const store = transaction.objectStore(STORES.LEARNING_HISTORY);
            const index = store.index('date');
            const range = IDBKeyRange.bound(today, today + '\uffff');
            const request = index.getAll(range);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 辅助方法
    async getWordById(id) {
        await this.ready();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.WORDS], 'readonly');
            const store = transaction.objectStore(STORES.WORDS);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getWordsForReview() {
        await this.ready();
        const now = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.USER_PROGRESS, STORES.WORDS], 'readonly');
            const progressStore = transaction.objectStore(STORES.USER_PROGRESS);
            const wordsStore = transaction.objectStore(STORES.WORDS);
            
            const index = progressStore.index('nextReview');
            const request = index.getAll(IDBKeyRange.upperBound(now));
            
            request.onsuccess = async () => {
                const progressItems = request.result;
                const words = [];
                
                for (const progress of progressItems) {
                    const wordRequest = wordsStore.get(progress.wordId);
                    wordRequest.onsuccess = () => {
                        if (wordRequest.result) {
                            words.push({
                                ...wordRequest.result,
                                progress
                            });
                        }
                    };
                }
                
                transaction.oncomplete = () => resolve(words);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    async getTodayWords(limit = 20) {
        const plan = await this.getDailyPlan();
        const reviewWords = await this.getWordsForReview();
        const allWords = await this.getAllWords();
        
        // 获取未学习的单词
        const learnedWordIds = new Set(reviewWords.map(w => w.id));
        const newWords = allWords
            .filter(w => !learnedWordIds.has(w.id))
            .sort(() => Math.random() - 0.5)
            .slice(0, plan.dailyGoal - Math.min(reviewWords.length, plan.reviewGoal));
        
        // 合并复习单词和新单词
        const reviewToTake = Math.min(reviewWords.length, plan.reviewGoal);
        return [...reviewWords.slice(0, reviewToTake), ...newWords];
    }

    async clearAllData() {
        await this.ready();
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(DB_NAME);
            
            request.onsuccess = () => {
                this.db = null;
                this.initPromise = this.init();
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }
}

// 导出单例实例
const wordDB = new WordDatabase();