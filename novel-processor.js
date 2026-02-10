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
            1: { name: '初级', freqRange: [1000, Infinity] }, // 最常见
            2: { name: '中级', freqRange: [500, 999] },
            3: { name: '高级', freqRange: [200, 499] },
            4: { name: '专业', freqRange: [50, 199] },
            5: { name: '学术', freqRange: [0, 49] }
        };
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

    // 获取词典数据（模拟）
    async getDictionaryData(word) {
        // 注意：实际应用中需要连接到真正的词典API
        // 这里使用模拟数据作为示例
        
        const mockData = {
            meaning: this.getMockMeaning(word),
            phonetic: this.getMockPhonetic(word),
            examples: this.getMockExamples(word),
            collins: this.getMockCollins(word)
        };
        
        return mockData;
    }

    getMockMeaning(word) {
        const meanings = {
            'profound': 'adj. 深刻的；意义深远的；渊博的',
            'eloquent': 'adj. 雄辩的；有说服力的；动人的',
            'resilient': 'adj. 有弹性的；适应力强的；能复原的',
            'ephemeral': 'adj. 短暂的；瞬息的',
            'ubiquitous': 'adj. 无所不在的；普遍存在的'
        };
        
        return meanings[word] || `${word} 的释义未找到`;
    }

    getMockPhonetic(word) {
        const phonetics = {
            'profound': '/prəˈfaʊnd/',
            'eloquent': '/ˈeləkwənt/',
            'resilient': '/rɪˈzɪliənt/',
            'ephemeral': '/ɪˈfemərəl/',
            'ubiquitous': '/juːˈbɪkwɪtəs/'
        };
        
        return phonetics[word] || '/ˈwɜːd/';
    }

    getMockExamples(word) {
        const examples = {
            'profound': 'His words had a profound impact on my life.',
            'eloquent': 'She delivered an eloquent speech that moved everyone.',
            'resilient': 'Children are often more resilient than adults.',
            'ephemeral': 'The beauty of cherry blossoms is ephemeral.',
            'ubiquitous': 'Smartphones have become ubiquitous in modern society.'
        };
        
        return examples[word] || `This is an example sentence for ${word}.`;
    }

    getMockCollins(word) {
        const collinsData = {
            'profound': {
                rank: '★★★★★',
                explanation: 'You use profound to emphasize that something is very great or intense.',
                examples: [
                    'The illness had a profound effect on his outlook.',
                    'Anna\'s patriotism was profound.'
                ]
            },
            'eloquent': {
                rank: '★★★★☆',
                explanation: 'Speech or writing that is eloquent is well expressed and effective in persuading people.',
                examples: [
                    'I heard him make a very eloquent speech at that dinner.',
                    'She was an eloquent speaker.'
                ]
            }
        };
        
        const defaultCollins = {
            rank: '★★★☆☆',
            explanation: 'This word is commonly used in English language.',
            examples: [
                `The word "${word}" appears in many contexts.`,
                `Learning "${word}" will improve your vocabulary.`
            ]
        };
        
        return collinsData[word] || defaultCollins;
    }

    // 批量获取单词数据
    // 在 novel-processor.js 中，修改 batchProcessWords 函数
    async batchProcessWords(words, callback) {
        const results = [];
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            
            try {
                const data = await this.getDictionaryData(word);
                const difficulty = this.assignDifficulty(word);
                const frequency = this.wordFrequency.get(word) || 0;
                
                const wordData = {
                    word: word,
                    difficulty: difficulty,
                    frequency: frequency,
                    meaning: data.meaning,
                    phonetic: data.phonetic,
                    example: Array.isArray(data.examples) ? data.examples[0] : data.examples,
                    collins: data.collins
                };
                
                results.push(wordData);
                
                // 更新进度
                if (callback) {
                    callback(i + 1, words.length, word);
                }
                
                // 避免请求过快
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                console.error(`处理单词 "${word}" 时出错:`, error);
                // 即使出错也返回一个基本的数据结构
                results.push({
                    word: word,
                    difficulty: this.assignDifficulty(word),
                    frequency: this.wordFrequency.get(word) || 0,
                    meaning: `${word} 的释义`,
                    phonetic: '/wɜːd/',
                    example: `This is an example sentence for ${word}.`,
                    collins: {
                        rank: '★★★☆☆',
                        explanation: 'This word appears in the uploaded novel.',
                        examples: [`The word "${word}" appears in this context.`]
                    }
                });
            }
        }
        
        return results;
    }
}

// 导出单例实例

const novelProcessor = new NovelProcessor();
