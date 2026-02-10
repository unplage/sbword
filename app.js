class WordLearnerApp {
    constructor() {
        this.db = wordDB;
        this.novelProcessor = novelProcessor;
        this.currentPage = 'home';
        this.learningWords = [];
        this.currentWordIndex = 0;
        this.showingDetails = false;
        
        this.init();
    }

    async init() {
        // 初始化数据库
        await this.db.ready();
        
        // 绑定事件
        this.bindEvents();
        
        // 加载初始数据
        await this.loadInitialData();
        
        // 更新今日进度
        await this.updateTodayProgress();
        
        // 初始化语音合成
        this.initSpeech();
    }

    bindEvents() {
        // 菜单切换
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                this.switchPage(page);
                this.closeSidebar();
            });
        });

        // 侧边栏
        document.getElementById('menuBtn').addEventListener('click', () => this.openSidebar());
        document.getElementById('closeSidebar').addEventListener('click', () => this.closeSidebar());
        document.getElementById('overlay').addEventListener('click', () => this.closeSidebar());

        // 快速开始按钮
        document.getElementById('startLearning').addEventListener('click', () => this.switchPage('learn'));
        document.getElementById('quickReview').addEventListener('click', () => this.startReview());
        document.getElementById('addWords').addEventListener('click', () => this.switchPage('novel'));

        // 学习页面
        document.getElementById('knowBtn').addEventListener('click', () => this.handleAnswer(true));
        document.getElementById('notKnowBtn').addEventListener('click', () => this.handleAnswer(false));
        document.getElementById('speakBtn').addEventListener('click', () => this.speakCurrentWord());
        document.getElementById('addToNewWords').addEventListener('click', () => this.toggleNewWord());
        document.getElementById('showDetails').addEventListener('click', () => this.toggleDetails());

        // 上传小说页面
        document.getElementById('selectFileBtn').addEventListener('click', () => {
            document.getElementById('novelFile').click();
        });

        const uploadArea = document.getElementById('uploadArea');
        uploadArea.addEventListener('click', () => {
            document.getElementById('novelFile').click();
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#4CAF50';
            uploadArea.style.background = 'rgba(76, 175, 80, 0.05)';
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '';
            uploadArea.style.background = '';
        });

        uploadArea.addEventListener('drop', async (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '';
            uploadArea.style.background = '';
            
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'text/plain') {
                await this.handleFileUpload(file);
            } else {
                this.showNotification('请上传txt格式的文件', 'error');
            }
        });

        document.getElementById('novelFile').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.handleFileUpload(file);
            }
        });

        document.getElementById('processBtn').addEventListener('click', () => this.processNovelFile());
        // 在 bindEvents 函数中添加以下代码（在适当位置）

        // 保存单词库按钮
        document.getElementById('saveWordsBtn').addEventListener('click', () => this.saveWordsFromNovel());

        // 单词库页面
        document.getElementById('difficultyFilter').addEventListener('change', () => this.loadWordsList());
        document.getElementById('sourceFilter').addEventListener('change', () => this.loadWordsList());
        document.getElementById('wordSearch').addEventListener('input', () => this.loadWordsList());

        // 生词本页面
        document.getElementById('studyNewWords').addEventListener('click', () => this.studyNewWords());
        document.getElementById('clearNewWords').addEventListener('click', () => this.clearNewWords());

        // 学习计划页面
        document.getElementById('savePlanBtn').addEventListener('click', () => this.saveDailyPlan());

        // 统计页面
        document.getElementById('statsBtn').addEventListener('click', () => this.showStats());

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSidebar();
            }
            
            // 学习页面快捷键
            if (this.currentPage === 'learn') {
                if (e.key === '1' || e.key === 'ArrowLeft') {
                    this.handleAnswer(false);
                } else if (e.key === '2' || e.key === 'ArrowRight') {
                    this.handleAnswer(true);
                } else if (e.key === ' ') {
                    e.preventDefault();
                    this.speakCurrentWord();
                } else if (e.key === 'd') {
                    this.toggleDetails();
                }
            }
        });
    }

    async loadInitialData() {
        try {
            // 加载今日进度
            await this.updateTodayProgress();
            
            // 加载学习计划
            const plan = await this.db.getDailyPlan();
            document.getElementById('dailyGoal').value = plan.dailyGoal;
            document.getElementById('reviewGoal').value = plan.reviewGoal;
            document.getElementById('studyTime').value = plan.studyTime;
            document.getElementById('notification').checked = plan.notifications;
            
            // 加载最近学习记录
            await this.loadRecentActivity();
            
            // 更新UI
            this.updatePlanStats();
        } catch (error) {
            console.error('加载初始数据失败:', error);
        }
    }

    async updateTodayProgress() {
        try {
            const todayHistory = await this.db.getTodayHistory();
            const plan = await this.db.getDailyPlan();
            
            const todayLearned = todayHistory.length;
            const dailyGoal = plan.dailyGoal;
            
            // 更新进度圈
            const progressCircle = document.getElementById('todayCircle');
            const progress = Math.min((todayLearned / dailyGoal) * 100, 100);
            const circumference = 2 * Math.PI * 15.9155;
            const offset = circumference - (progress / 100) * circumference;
            
            progressCircle.style.strokeDasharray = `${circumference - offset} ${offset}`;
            
            // 更新文本
            document.getElementById('todayCount').textContent = todayLearned;
            document.getElementById('totalGoal').textContent = dailyGoal;
            document.getElementById('todayProgress').textContent = `${todayLearned}/${dailyGoal}`;
            
            // 更新坚持天数（简化实现）
            const streak = localStorage.getItem('learningStreak') || '0';
            document.getElementById('streakDays').textContent = streak;
            
            // 更新总词汇量
            const allWords = await this.db.getAllWords();
            document.getElementById('totalWords').textContent = allWords.length;
            
        } catch (error) {
            console.error('更新今日进度失败:', error);
        }
    }

    async loadRecentActivity() {
        try {
            const recentList = document.getElementById('recentList');
            const todayHistory = await this.db.getTodayHistory();
            
            if (todayHistory.length === 0) {
                recentList.innerHTML = '<p class="empty-state">今天还没有学习记录</p>';
                return;
            }
            
            // 获取最近的5条记录
            const recentItems = todayHistory.slice(-5).reverse();
            let html = '';
            
            for (const item of recentItems) {
                const word = await this.db.getWordById(item.wordId);
                if (word) {
                    html += `
                        <div class="recent-item">
                            <span class="recent-word">${word.word}</span>
                            <span class="recent-result ${item.correct ? 'correct' : 'incorrect'}">
                                ${item.correct ? '✓' : '✗'}
                            </span>
                        </div>
                    `;
                }
            }
            
            recentList.innerHTML = html;
        } catch (error) {
            console.error('加载最近活动失败:', error);
        }
    }

    switchPage(pageName) {
        // 隐藏所有页面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // 移除菜单激活状态
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // 显示目标页面
        const targetPage = document.getElementById(`${pageName}Page`);
        if (targetPage) {
            targetPage.classList.add('active');
            
            // 激活对应菜单项
            const menuItem = document.querySelector(`[data-page="${pageName}"]`);
            if (menuItem) {
                menuItem.classList.add('active');
            }
            
            this.currentPage = pageName;
            
            // 页面特定的初始化
            switch(pageName) {
                case 'learn':
                    this.startLearningSession();
                    break;
                case 'words':
                    this.loadWordsList();
                    break;
                case 'new-words':
                    this.loadNewWordsList();
                    break;
                case 'plan':
                    this.updatePlanStats();
                    break;
            }
        }
    }

    openSidebar() {
        document.getElementById('sidebar').style.left = '0';
        document.getElementById('overlay').classList.add('active');
    }

    closeSidebar() {
        document.getElementById('sidebar').style.left = '-300px';
        document.getElementById('overlay').classList.remove('active');
    }

    async startLearningSession() {
        try {
            this.showLoader('正在准备学习内容...');
            
            this.learningWords = await this.db.getTodayWords();
            this.currentWordIndex = 0;
            this.showingDetails = false;
            
            if (this.learningWords.length === 0) {
                this.showNotification('今天的学习任务已完成！', 'success');
                this.switchPage('home');
                return;
            }
            
            // 更新UI
            document.getElementById('learnedCount').textContent = this.currentWordIndex + 1;
            document.getElementById('totalToLearn').textContent = this.learningWords.length;
            
            await this.displayCurrentWord();
            this.hideLoader();
        } catch (error) {
            console.error('开始学习会话失败:', error);
            this.hideLoader();
            this.showNotification('加载学习内容失败', 'error');
        }
    }

    async displayCurrentWord() {
        if (this.currentWordIndex >= this.learningWords.length) {
            await this.completeLearningSession();
            return;
        }
        
        const wordData = this.learningWords[this.currentWordIndex];
        
        // 更新单词显示
        document.getElementById('currentWord').textContent = wordData.word;
        document.getElementById('wordPhonetic').textContent = wordData.phonetic || '/ˈwɜːd/';
        document.getElementById('wordMeaning').textContent = wordData.meaning || '暂无释义';
        document.getElementById('wordExample').textContent = wordData.example || '暂无例句';
        
        // 更新难度徽章
        const difficultyBadge = document.getElementById('difficultyBadge');
        difficultyBadge.textContent = this.getDifficultyText(wordData.difficulty);
        difficultyBadge.dataset.level = wordData.difficulty;
        
        // 更新柯林斯词典内容
        this.updateCollinsContent(wordData);
        
        // 更新进度
        document.getElementById('learnedCount').textContent = this.currentWordIndex + 1;
        
        // 检查是否在生词本中
        this.updateNewWordButton(wordData.id);
        
        // 显示/隐藏详细信息
        const detailsSection = document.getElementById('wordDetails');
        if (this.showingDetails) {
            detailsSection.style.display = 'block';
        } else {
            detailsSection.style.display = 'none';
        }
    }

    updateCollinsContent(wordData) {
        const collinsContent = document.getElementById('collinsContent');
        
        if (wordData.collins) {
            const collins = wordData.collins;
            collinsContent.innerHTML = `
                <div class="collins-rank">${collins.rank}</div>
                <p>${collins.explanation}</p>
                <div class="collins-examples">
                    <strong>例句：</strong>
                    <ul>
                        ${collins.examples.map(example => `<li>${example}</li>`).join('')}
                    </ul>
                </div>
            `;
        } else {
            collinsContent.innerHTML = '<p>柯林斯词典数据未找到</p>';
        }
    }

    async handleAnswer(correct) {
        const wordData = this.learningWords[this.currentWordIndex];
        
        try {
            // 更新学习进度
            await this.db.updateProgress(wordData.id, correct);
            
            // 记录学习历史
            await this.db.addLearningHistory(wordData.id, correct);
            
            // 播放音效（可选）
            this.playAnswerSound(correct);
            
            // 显示反馈
            if (correct) {
                this.showNotification('✓ 答对了！', 'success');
            } else {
                this.showNotification('✗ 答错了，已加入复习列表', 'warning');
                
                // 自动加入生词本
                await this.db.addToNewWords(wordData.id);
            }
            
            // 下一个单词
            this.currentWordIndex++;
            
            if (this.currentWordIndex < this.learningWords.length) {
                await this.displayCurrentWord();
            } else {
                await this.completeLearningSession();
            }
            
            // 更新今日进度
            await this.updateTodayProgress();
            await this.loadRecentActivity();
            
        } catch (error) {
            console.error('处理答案失败:', error);
            this.showNotification('处理失败，请重试', 'error');
        }
    }

    async completeLearningSession() {
        this.showNotification('恭喜完成今日学习！', 'success');
        
        // 更新UI
        document.getElementById('learnedCount').textContent = this.learningWords.length;
        
        // 延迟返回首页
        setTimeout(() => {
            this.switchPage('home');
        }, 1500);
    }

    initSpeech() {
        this.speechSynthesis = window.speechSynthesis;
        this.voices = [];
        
        // 加载可用语音
        this.speechSynthesis.onvoiceschanged = () => {
            this.voices = this.speechSynthesis.getVoices();
        };
    }

    speakCurrentWord() {
        const word = document.getElementById('currentWord').textContent;
        
        if (!this.speechSynthesis) {
            this.showNotification('您的浏览器不支持语音合成', 'error');
            return;
        }
        
        // 停止当前语音
        this.speechSynthesis.cancel();
        
        // 创建语音实例
        const utterance = new SpeechSynthesisUtterance(word);
        
        // 设置语音参数
        utterance.rate = 0.8;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // 选择英语语音
        const englishVoice = this.voices.find(voice => 
            voice.lang.startsWith('en') && voice.name.includes('Female')
        ) || this.voices.find(voice => voice.lang.startsWith('en'));
        
        if (englishVoice) {
            utterance.voice = englishVoice;
        }
        
        // 播放语音
        this.speechSynthesis.speak(utterance);
        
        // 播放动画效果
        const speakBtn = document.getElementById('speakBtn');
        speakBtn.classList.add('speaking');
        setTimeout(() => speakBtn.classList.remove('speaking'), 500);
    }

    async toggleNewWord() {
        const wordData = this.learningWords[this.currentWordIndex];
        const button = document.getElementById('addToNewWords');
        
        try {
            if (button.innerHTML.includes('far')) {
                // 加入生词本
                await this.db.addToNewWords(wordData.id);
                button.innerHTML = '<i class="fas fa-star"></i> 移出生词本';
                this.showNotification('已加入生词本', 'success');
            } else {
                // 移出生词本
                await this.db.removeFromNewWords(wordData.id);
                button.innerHTML = '<i class="far fa-star"></i> 加入生词本';
                this.showNotification('已移出生词本', 'info');
            }
        } catch (error) {
            console.error('操作生词本失败:', error);
            this.showNotification('操作失败', 'error');
        }
    }

    updateNewWordButton(wordId) {
        const button = document.getElementById('addToNewWords');
        
        // 检查是否已在生词本中
        this.db.getNewWords().then(newWords => {
            const isInNewWords = newWords.some(item => item.id === wordId);
            
            if (isInNewWords) {
                button.innerHTML = '<i class="fas fa-star"></i> 移出生词本';
            } else {
                button.innerHTML = '<i class="far fa-star"></i> 加入生词本';
            }
        });
    }

    toggleDetails() {
        this.showingDetails = !this.showingDetails;
        const detailsSection = document.getElementById('wordDetails');
        const button = document.getElementById('showDetails');
        
        if (this.showingDetails) {
            detailsSection.style.display = 'block';
            button.innerHTML = '<i class="fas fa-eye-slash"></i> 隐藏信息';
        } else {
            detailsSection.style.display = 'none';
            button.innerHTML = '<i class="fas fa-info-circle"></i> 详细信息';
        }
    }

    async handleFileUpload(file) {
        try {
            const text = await file.text();
            
            // 显示文件信息
            const uploadArea = document.getElementById('uploadArea');
            uploadArea.innerHTML = `
                <i class="fas fa-file-alt upload-icon" style="color: #4CAF50;"></i>
                <p><strong>${file.name}</strong></p>
                <p>大小: ${(file.size / 1024).toFixed(2)} KB</p>
                <button class="upload-btn" id="changeFileBtn">更换文件</button>
            `;
            
            // 重新绑定更换文件按钮
            setTimeout(() => {
                document.getElementById('changeFileBtn').addEventListener('click', () => {
                    document.getElementById('novelFile').click();
                });
            }, 100);
            
            // 保存文件内容
            this.novelFileContent = text;
            document.getElementById('processBtn').disabled = false;
            
        } catch (error) {
            console.error('读取文件失败:', error);
            this.showNotification('读取文件失败', 'error');
        }
    }

    async processNovelFile() {
        if (!this.novelFileContent) {
            this.showNotification('请先选择文件', 'error');
            return;
        }
        
        try {
            this.showLoader('正在处理小说内容...');
            
            // 获取处理选项
            const options = {
                excludeCommon: document.getElementById('excludeCommon').checked,
                minFrequency: parseInt(document.getElementById('minFrequency').value),
                autoDifficulty: document.getElementById('autoDifficulty').checked
            };
            
            // 处理小说
            const result = await this.novelProcessor.processNovel(
                this.novelFileContent, 
                options
            );
            
            // 显示处理结果
            this.showProcessingResult(result);
            
            // 保存处理结果
            this.currentNovelWords = result.wordList;
            this.currentNovelResult = result;
            
            this.hideLoader();
            
        } catch (error) {
            console.error('处理小说失败:', error);
            this.hideLoader();
            this.showNotification('处理小说失败', 'error');
        }
    }

    showProcessingResult(result) {
        const resultSection = document.getElementById('processingResult');
        resultSection.style.display = 'block';
        
        // 更新统计信息
        document.getElementById('totalWordsCount').textContent = result.totalWords;
        document.getElementById('uniqueWordsCount').textContent = result.uniqueWords;
        document.getElementById('validWordsCount').textContent = result.wordList.length;
        
        // 更新难度分布
        const difficultyBars = document.querySelector('.difficulty-bars');
        let html = '';
        
        Object.entries(result.difficultyDistribution).forEach(([level, count]) => {
            const percentage = result.wordList.length > 0 ? 
                (count / result.wordList.length * 100).toFixed(1) : 0;
            
            const levelText = this.getDifficultyText(level);
            
            html += `
                <div class="difficulty-bar">
                    <div class="difficulty-label">${levelText}</div>
                    <div class="bar-container">
                        <div class="bar" style="width: ${percentage}%" data-level="${level}"></div>
                        <span class="bar-count">${count} (${percentage}%)</span>
                    </div>
                </div>
            `;
        });
        
        difficultyBars.innerHTML = html;
    }

    async saveWordsFromNovel() {
        if (!this.currentNovelWords || this.currentNovelWords.length === 0) {
            this.showNotification('没有可保存的单词', 'error');
            return;
        }
        
        try {
            this.showLoader('正在保存单词到数据库...');
            
            let savedCount = 0;
            let skippedCount = 0;
            const totalWords = this.currentNovelWords.length;
            
            // 批量处理单词
            const processedWords = await this.novelProcessor.batchProcessWords(
                this.currentNovelWords,
                (current, total, word) => {
                    this.showLoader(`正在处理单词: ${word} (${current}/${total})`);
                }
            );
            
            // 保存到数据库
            for (let i = 0; i < processedWords.length; i++) {
                const wordData = processedWords[i];
                
                try {
                    // 检查单词是否已存在
                    const existingWord = await this.db.getWord(wordData.word);
                    
                    if (existingWord) {
                        // 单词已存在，跳过
                        skippedCount++;
                        console.log(`单词 "${wordData.word}" 已存在，跳过`);
                    } else {
                        // 保存新单词
                        await this.db.addWord({
                            word: wordData.word,
                            difficulty: wordData.difficulty,
                            frequency: wordData.frequency,
                            meaning: wordData.meaning,
                            phonetic: wordData.phonetic,
                            example: wordData.example,
                            collins: wordData.collins,
                            source: 'novel',
                            createdAt: new Date().toISOString(),
                            lastReviewed: null,
                            reviewCount: 0
                        });
                        savedCount++;
                        console.log(`保存单词: ${wordData.word}`);
                    }
                    
                    // 更新进度
                    if (i % 10 === 0 || i === processedWords.length - 1) {
                        this.showLoader(`正在保存单词: ${wordData.word} (${i + 1}/${totalWords})`);
                    }
                    
                } catch (error) {
                    console.error(`保存单词 "${wordData.word}" 时出错:`, error);
                    skippedCount++;
                }
            }
            
            this.hideLoader();
            this.showNotification(`成功保存 ${savedCount} 个单词到单词库（${skippedCount} 个已存在）`, 'success');
            
            // 清空当前处理结果
            this.currentNovelWords = null;
            this.currentNovelResult = null;
            
            // 重置上传界面
            this.resetUploadInterface();
            
            // 更新首页统计
            await this.updateTodayProgress();
            
            // 如果当前在单词库页面，刷新列表
            if (this.currentPage === 'words') {
                await this.loadWordsList();
            }
            
        } catch (error) {
            console.error('保存单词失败:', error);
            this.hideLoader();
            this.showNotification('保存单词失败: ' + error.message, 'error');
        }
    }
    
    // 添加重置上传界面的方法
    resetUploadInterface() {
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.innerHTML = `
            <i class="fas fa-cloud-upload-alt upload-icon"></i>
            <p>点击或拖拽文件到此区域</p>
            <input type="file" id="novelFile" accept=".txt" style="display: none;">
            <button class="upload-btn" id="selectFileBtn">选择文件</button>
        `;
        
        // 重新绑定事件
        setTimeout(() => {
            document.getElementById('selectFileBtn').addEventListener('click', () => {
                document.getElementById('novelFile').click();
            });
            
            const fileInput = document.getElementById('novelFile');
            fileInput.value = ''; // 清空文件输入
        }, 100);
        
        document.getElementById('processingResult').style.display = 'none';
        document.getElementById('processBtn').disabled = true;
        this.novelFileContent = null;
    }

    async loadWordsList() {
        try {
            const filter = {
                difficulty: document.getElementById('difficultyFilter').value,
                source: document.getElementById('sourceFilter').value,
                search: document.getElementById('wordSearch').value
            };
            
            const words = await this.db.getAllWords(filter);
            const wordsList = document.getElementById('wordsList');
            
            if (words.length === 0) {
                wordsList.innerHTML = '<p class="empty-state">暂无单词</p>';
                return;
            }
            
            let html = '';
            
            for (const word of words) {
                const progress = await this.db.getProgress(word.id);
                const familiarity = progress ? progress.familiarity : 0;
                
                html += `
                    <div class="word-item">
                        <div class="word-content">
                            <div class="word-text">${word.word}</div>
                            <div class="word-phonetic">${word.phonetic || ''}</div>
                            <div class="word-meaning">${word.meaning || ''}</div>
                            <div class="word-meta">
                                <span class="difficulty-badge small" data-level="${word.difficulty}">
                                    ${this.getDifficultyText(word.difficulty)}
                                </span>
                                <span class="familiarity">
                                    <i class="fas fa-star"></i> ${familiarity}/5
                                </span>
                            </div>
                        </div>
                        <div class="word-actions">
                            <button class="icon-btn small" onclick="app.speakWord('${word.word}')">
                                <i class="fas fa-volume-up"></i>
                            </button>
                            <button class="icon-btn small" onclick="app.addWordToStudy('${word.id}')">
                                <i class="fas fa-book-open"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
            
            wordsList.innerHTML = html;
            
        } catch (error) {
            console.error('加载单词列表失败:', error);
        }
    }

    async loadNewWordsList() {
        try {
            const newWords = await this.db.getNewWords();
            const newWordsList = document.getElementById('newWordsList');
            
            if (newWords.length === 0) {
                newWordsList.innerHTML = '<p class="empty-state">生词本为空</p>';
                return;
            }
            
            let html = '';
            
            for (const word of newWords) {
                const addedDate = new Date(word.addedAt);
                const dateStr = addedDate.toLocaleDateString();
                
                html += `
                    <div class="word-item">
                        <div class="word-content">
                            <div class="word-text">${word.word}</div>
                            <div class="word-phonetic">${word.phonetic || ''}</div>
                            <div class="word-meaning">${word.meaning || ''}</div>
                            <div class="word-meta">
                                <span class="added-date">添加于: ${dateStr}</span>
                            </div>
                        </div>
                        <div class="word-actions">
                            <button class="icon-btn small" onclick="app.removeFromNewWords(${word.id})">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
            
            newWordsList.innerHTML = html;
            
        } catch (error) {
            console.error('加载生词本失败:', error);
        }
    }

    async removeFromNewWords(wordId) {
        try {
            await this.db.removeFromNewWords(wordId);
            await this.loadNewWordsList();
            this.showNotification('已从生词本移除', 'success');
        } catch (error) {
            console.error('移除生词失败:', error);
            this.showNotification('移除失败', 'error');
        }
    }

    async studyNewWords() {
        try {
            const newWords = await this.db.getNewWords();
            
            if (newWords.length === 0) {
                this.showNotification('生词本为空', 'info');
                return;
            }
            
            // 设置学习单词为生词本内容
            this.learningWords = newWords;
            this.currentWordIndex = 0;
            this.showingDetails = false;
            
            // 切换到学习页面
            this.switchPage('learn');
            
        } catch (error) {
            console.error('开始学习生词失败:', error);
            this.showNotification('开始学习失败', 'error');
        }
    }

    async clearNewWords() {
        if (!confirm('确定要清空生词本吗？此操作不可恢复。')) {
            return;
        }
        
        try {
            const newWords = await this.db.getNewWords();
            
            for (const word of newWords) {
                await this.db.removeFromNewWords(word.id);
            }
            
            await this.loadNewWordsList();
            this.showNotification('生词本已清空', 'success');
            
        } catch (error) {
            console.error('清空生词本失败:', error);
            this.showNotification('清空失败', 'error');
        }
    }

    async saveDailyPlan() {
        try {
            const plan = {
                dailyGoal: parseInt(document.getElementById('dailyGoal').value) || 20,
                reviewGoal: parseInt(document.getElementById('reviewGoal').value) || 50,
                studyTime: document.getElementById('studyTime').value,
                notifications: document.getElementById('notification').checked
            };
            
            await this.db.saveDailyPlan(plan);
            this.showNotification('学习计划已保存', 'success');
            
            // 更新UI
            await this.updateTodayProgress();
            this.updatePlanStats();
            
        } catch (error) {
            console.error('保存学习计划失败:', error);
            this.showNotification('保存失败', 'error');
        }
    }

    async updatePlanStats() {
        try {
            const plan = await this.db.getDailyPlan();
            const todayHistory = await this.db.getTodayHistory();
            const allWords = await this.db.getAllWords();
            
            // 计算完成率
            const completionRate = plan.dailyGoal > 0 ? 
                Math.min((todayHistory.length / plan.dailyGoal) * 100, 100) : 0;
            
            // 获取坚持天数（简化实现）
            const streak = localStorage.getItem('learningStreak') || '0';
            
            // 更新UI
            document.getElementById('planCompletion').textContent = `${completionRate.toFixed(0)}%`;
            document.getElementById('planDays').textContent = streak;
            document.getElementById('planLearned').textContent = allWords.length;
            
        } catch (error) {
            console.error('更新计划统计失败:', error);
        }
    }

    async startReview() {
        try {
            const reviewWords = await this.db.getWordsForReview();
            
            if (reviewWords.length === 0) {
                this.showNotification('暂时没有需要复习的单词', 'info');
                return;
            }
            
            // 设置学习单词为复习内容
            this.learningWords = reviewWords;
            this.currentWordIndex = 0;
            this.showingDetails = false;
            
            // 切换到学习页面
            this.switchPage('learn');
            
        } catch (error) {
            console.error('开始复习失败:', error);
            this.showNotification('开始复习失败', 'error');
        }
    }

    // 工具方法
    getDifficultyText(level) {
        const levels = {
            1: '初级',
            2: '中级',
            3: '高级',
            4: '专业',
            5: '学术'
        };
        return levels[level] || '未知';
    }

    showLoader(message = '加载中...') {
        const loader = document.getElementById('loader');
        loader.querySelector('p').textContent = message;
        loader.classList.add('active');
    }

    hideLoader() {
        document.getElementById('loader').classList.remove('active');
    }

    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 
                                 type === 'error' ? 'exclamation-circle' : 
                                 type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 显示动画
        setTimeout(() => notification.classList.add('show'), 10);
        
        // 自动隐藏
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    playAnswerSound(correct) {
        // 创建音频上下文（如果支持）
        if (window.AudioContext || window.webkitAudioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext();
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // 设置声音参数
            oscillator.frequency.value = correct ? 800 : 400;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        }
    }

    // 全局方法供内联事件调用
    speakWord(word) {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.rate = 0.8;
        speechSynthesis.speak(utterance);
    }

    async addWordToStudy(wordId) {
        try {
            const word = await this.db.getWordById(wordId);
            if (word) {
                this.learningWords = [word];
                this.currentWordIndex = 0;
                this.switchPage('learn');
            }
        } catch (error) {
            console.error('添加单词到学习失败:', error);
        }
    }
}

// 添加通知样式
const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
    .notification {
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        border-radius: 8px;
        padding: 16px 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1003;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        max-width: 300px;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification.success {
        border-left: 4px solid #4CAF50;
    }
    
    .notification.error {
        border-left: 4px solid #F44336;
    }
    
    .notification.warning {
        border-left: 4px solid #FF9800;
    }
    
    .notification.info {
        border-left: 4px solid #2196F3;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .notification-content i {
        font-size: 1.2rem;
    }
    
    .notification.success i {
        color: #4CAF50;
    }
    
    .notification.error i {
        color: #F44336;
    }
    
    .notification.warning i {
        color: #FF9800;
    }
    
    .notification.info i {
        color: #2196F3;
    }
    
    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--gray-color);
    }
`;
document.head.appendChild(notificationStyle);

// 初始化应用
let app;
window.addEventListener('DOMContentLoaded', async () => {
    app = new WordLearnerApp();
    
    // 暴露到全局
    window.app = app;

});
