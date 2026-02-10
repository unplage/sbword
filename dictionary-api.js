// dictionary-api.js - 词典API模块
class DictionaryAPI {
  constructor() {
    this.baseUrl = 'https://api.dictionaryapi.dev/api/v2/entries/en';
  }
  async fetchWordData(word) {
    try {
      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(word)}`);
      if (!response.ok) {
        // 如果未找到单词（如返回404），API会返回一个包含 message 字段的JSON
        const errorData = await response.json();
        throw new Error(errorData.message || `查询失败: ${response.status}`);
      }
      const data = await response.json();
      return this.parseData(data[0]); // 取第一个结果
    } catch (error) {
      console.error(`获取单词 "${word}" 数据失败:`, error);
      // 返回一个默认结构，保证应用不崩溃
      return this.getFallbackData(word);
    }
  }
  parseData(apiData) {
    // 解析API返回的复杂JSON，提取我们需要的信息
    const firstMeaning = apiData.meanings?.[0];
    const firstDefinition = firstMeaning?.definitions?.[0];
    // 获取英式或美式音标
    const phoneticText = apiData.phonetic || 
                          apiData.phonetics?.find(p => p.text)?.text || 
                          '';
    return {
      word: apiData.word,
      phonetic: phoneticText,
      // 整合所有释义和例句（简化示例，实际可做更丰富展示）
      meaning: firstMeaning ? `${firstMeaning.partOfSpeech}. ${firstDefinition?.definition || '暂无释义'}` : '暂无释义',
      example: firstDefinition?.example || '',
      // 可以保存原始数据供“详细信息”页面使用
      rawData: apiData 
    };
  }
  getFallbackData(word) {
    // 当API请求失败时返回的保底数据
    return {
      word: word,
      phonetic: '',
      meaning: `（在线查询失败，请检查网络或稍后重试）`,
      example: '',
      rawData: null
    };
  }
}
export const dictionaryAPI = new DictionaryAPI();