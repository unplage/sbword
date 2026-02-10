// 小说处理模块 - 集成网络词典API
// 常见简单单词列表（过滤用）
const COMMON_WORDS = new Set([
    // 基础词汇
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'down', 'out', 'off', 'over', 'under',
    'I', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
    'this', 'that', 'these', 'those',
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should',
    'can', 'could', 'may', 'might', 'must',
    'go', 'went', 'gone', 'come', 'came', 'get', 'got', 'gotten',
    'see', 'saw', 'seen', 'look', 'looked', 'say', 'said', 'tell', 'told',
    'know', 'knew', 'known', 'think', 'thought',
    'one', 'two', 'three', 'first', 'second', 'third',
    'good', 'bad', 'big', 'small', 'new', 'old', 'young',
    'time', 'times', 'year', 'years', 'day', 'days', 'week', 'weeks',
    'man', 'men', 'woman', 'women', 'child', 'children',
    'dog', 'cat', 'house', 'home', 'car', 'water', 'food', 'air', 'sun', 'moon',
    // 更多常见词...
    'very', 'just', 'not', 'no', 'yes', 'so', 'as', 'if', 'then', 'than', 'when', 'where',
    'why', 'how', 'all', 'any', 'some', 'such', 'same', 'different', 'other', 'another',
    'more', 'most', 'less', 'least', 'many', 'much', 'few', 'little',
    'here', 'there', 'now', 'then', 'again', 'always', 'never', 'often', 'sometimes',
    'well', 'better', 'best', 'also', 'too', 'either', 'neither', 'only', 'even',
    'back', 'way', 'like', 'people', 'made', 'make', 'part', 'take', 'took', 'taken',
    'put', 'set', 'let', 'use', 'used', 'work', 'worked', 'life', 'live', 'lived',
    'give', 'gave', 'given', 'find', 'found', 'try', 'tried', 'ask', 'asked',
    'need', 'needed', 'feel', 'felt', 'become', 'became', 'leave', 'left',
    'call', 'called', 'seem', 'seemed', 'help', 'helped', 'show', 'showed', 'shown',
    'hear', 'heard', 'play', 'played', 'run', 'ran', 'move', 'moved'
]);

class NovelProcessor {
    constructor() {
        this.wordFrequency = new Map();
        this.difficultyLevels = {
            1: { name: '初级', freqRange: [1000, Infinity] },
            2: { name: '中级', freqRange: [500, 999] },
            3: { name: '高级', freqRange: [200, 499] },
            4: { name: '专业', freqRange: [50, 199] },
            5: { name: '学术', freqRange: [0, 49] }
        };
        
        // 缓存已经查询过的单词，避免重复请求
        this.dictionaryCache = new Map();
    }

    // 处理小说文本
    async processNovel(text, options = {}) {
        const {
            excludeCommon = true,
            minFrequency = 3,
            autoDifficulty = true
        } = options;

        console.log('开始处理小说文本...');
        
        // 1. 清理文本
        const cleanedText = this.cleanText(text);
        
        // 2. 提取单词
        const words = this.extractWords(cleanedText);
        console.log(`提取到 ${words.length} 个单词`);
        
        // 3. 统计词频
        this.calculateFrequency(words);
        
        // 4. 过滤单词
        let filteredWords = this.filterWords(words, {
            excludeCommon,
            minFrequency
        });
        
        console.log(`过滤后剩余 ${filteredWords.length} 个单词`);
        
        // 5. 去重
        const uniqueWords = [...new Set(filteredWords)];
        console.log(`去重后剩余 ${uniqueWords.length} 个单词`);
        
        // 6. 难度分级
        if (autoDifficulty) {
            uniqueWords.forEach(word => {
                this.assignDifficulty(word);
            });
        }
        
        return {
            totalWords: words.length,
            uniqueWords: uniqueWords.length,
            wordList: uniqueWords,
            frequencyMap: this.wordFrequency,
            difficultyDistribution: this.getDifficultyDistribution(uniqueWords)
        };
    }

    // 清理文本
    cleanText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s']/g, ' ') // 保留字母、数字、空格和撇号
            .replace(/\s+/g, ' ')      // 合并多个空格
            .trim();
    }

    // 提取单词
    extractWords(text) {
        return text.split(' ')
            .map(word => word.replace(/^'|'$/g, '')) // 去除首尾引号
            .filter(word => word.length > 1) // 过滤单字母单词
            .filter(word => !/^\d+$/.test(word)); // 过滤纯数字
    }

    // 计算词频
    calculateFrequency(words) {
        this.wordFrequency.clear();
        words.forEach(word => {
            this.wordFrequency.set(word, (this.wordFrequency.get(word) || 0) + 1);
        });
    }

    // 过滤单词
    filterWords(words, options) {
        const { excludeCommon, minFrequency } = options;
        
        return words.filter(word => {
            const frequency = this.wordFrequency.get(word);
            
            // 频率过滤
            if (frequency < minFrequency) {
                return false;
            }
            
            // 常见词过滤
            if (excludeCommon && COMMON_WORDS.has(word)) {
                return false;
            }
            
            // 长度过滤（避免过长或过短的奇怪单词）
            if (word.length < 3 || word.length > 20) {
                return false;
            }
            
            return true;
        });
    }

    // 分配难度等级
    assignDifficulty(word) {
        const frequency = this.wordFrequency.get(word) || 0;
        
        for (const [level, config] of Object.entries(this.difficultyLevels)) {
            if (frequency >= config.freqRange[0] && frequency <= config.freqRange[1]) {
                return parseInt(level);
            }
        }
        
        return 3; // 默认中级
    }

    // 获取难度分布
    getDifficultyDistribution(words) {
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        
        words.forEach(word => {
            const level = this.assignDifficulty(word);
            distribution[level]++;
        });
        
        return distribution;
    }

    // 获取词典数据 - 使用网络API
    async getDictionaryData(word) {
        // 检查缓存
        if (this.dictionaryCache.has(word)) {
            return this.dictionaryCache.get(word);
        }
        
        try {
            // 使用 Free Dictionary API
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
            
            if (!response.ok) {
                throw new Error(`API响应错误: ${response.status}`);
            }
            
            const data = await response.json();
            
            // 解析API响应
            const parsedData = this.parseDictionaryResponse(data, word);
            
            // 缓存结果
            this.dictionaryCache.set(word, parsedData);
            
            return parsedData;
            
        } catch (error) {
            console.warn(`获取单词"${word}"的词典数据失败:`, error);
            
            // 返回降级数据
            const fallbackData = this.getFallbackData(word);
            this.dictionaryCache.set(word, fallbackData);
            return fallbackData;
        }
    }

    // 解析API响应
    parseDictionaryResponse(apiData, originalWord) {
        if (!apiData || !apiData.length) {
            return this.getFallbackData(originalWord);
        }
        
        const entry = apiData[0];
        
        // 获取音标
        let phonetic = '';
        if (entry.phonetic) {
            phonetic = entry.phonetic;
        } else if (entry.phonetics && entry.phonetics.length > 0) {
            // 尝试获取第一个有文本的音标
            const firstPhonetic = entry.phonetics.find(p => p.text);
            if (firstPhonetic) {
                phonetic = firstPhonetic.text;
            }
        }
        
        // 获取释义和例句
        let meaning = '';
        let example = '';
        
        if (entry.meanings && entry.meanings.length > 0) {
            // 取第一个词性的第一个释义
            const firstMeaning = entry.meanings[0];
            const partOfSpeech = firstMeaning.partOfSpeech || '';
            
            if (firstMeaning.definitions && firstMeaning.definitions.length > 0) {
                const firstDefinition = firstMeaning.definitions[0];
                meaning = `${partOfSpeech ? partOfSpeech + '. ' : ''}${firstDefinition.definition || '暂无释义'}`;
                
                // 取第一个例句
                if (firstDefinition.example) {
                    example = firstDefinition.example;
                }
            }
        }
        
        // 获取更多例句（从所有释义中收集）
        const examples = [];
        if (entry.meanings) {
            entry.meanings.forEach(meaningObj => {
                if (meaningObj.definitions) {
                    meaningObj.definitions.forEach(def => {
                        if (def.example && examples.length < 3) {
                            examples.push(def.example);
                        }
                    });
                }
            });
        }
        
        return {
            meaning: meaning || `${originalWord} 的释义`,
            phonetic: phonetic || `/${this.generatePhoneticFallback(originalWord)}/`,
            examples: examples.length > 0 ? examples : [`This is an example sentence for ${originalWord}.`],
            collins: null, // 不再使用柯林斯词典
            rawApiData: entry // 保存原始API数据供后续使用
        };
    }

    // 生成降级音标（简单规则）
    generatePhoneticFallback(word) {
        // 简单的音标降级规则
        const vowels = 'aeiou';
        let phonetic = '';
        
        for (let char of word.toLowerCase()) {
            if (vowels.includes(char)) {
                phonetic += 'ə';
            } else {
                phonetic += char;
            }
        }
        
        return phonetic;
    }

    // 获取降级数据（当API失败时使用）
    getFallbackData(word) {
        return {
            meaning: `${word} 的释义（网络数据获取失败，请检查网络）`,
            phonetic: `/${this.generatePhoneticFallback(word)}/`,
            examples: [`This is an example sentence for ${word}.`],
            collins: null
        };
    }

    // 批量获取单词数据（修改为使用网络API）
    async batchProcessWords(words, callback) {
        const results = [];
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            
            try {
                // 从网络API获取数据
                const data = await this.getDictionaryData(word);
                const difficulty = this.assignDifficulty(word);
                const frequency = this.wordFrequency.get(word) || 0;
                
                results.push({
                    word,
                    difficulty,
                    frequency,
                    meaning: data.meaning,
                    phonetic: data.phonetic,
                    example: Array.isArray(data.examples) ? data.examples[0] : data.examples,
                    collins: data.collins,
                    rawData: data.rawApiData // 保存原始数据
                });
                
                // 更新进度
                if (callback) {
                    callback(i + 1, words.length, word);
                }
                
                // 添加延迟，避免请求过快
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.error(`处理单词 "${word}" 时出错:`, error);
                
                // 即使出错也返回一个基本的数据结构
                const fallbackData = this.getFallbackData(word);
                results.push({
                    word,
                    difficulty: this.assignDifficulty(word),
                    frequency: this.wordFrequency.get(word) || 0,
                    meaning: fallbackData.meaning,
                    phonetic: fallbackData.phonetic,
                    example: fallbackData.examples[0],
                    collins: null
                });
            }
        }
        
        return results;
    }
}

// 导出单例实例
const novelProcessor = new NovelProcessor();
