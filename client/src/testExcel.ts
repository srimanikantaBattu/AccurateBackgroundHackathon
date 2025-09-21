import ExcelProcessor from './excelProcessor';

// Test function to demonstrate Excel processing
export const testExcelProcessing = async (file: File) => {
  try {
    const processor = ExcelProcessor.getInstance();
    const data = await processor.processExcelFile(file);
    
    console.log('Excel Data Processed:', data);
    console.log('Sheets:', data.sheetNames);
    console.log('Summary:', data.summary);
    
    // Test querying
    const searchResults = processor.searchData('test');
    console.log('Search Results:', searchResults);
    
    // Test AI formatting
    const aiFormattedData = processor.formatDataForAI();
    console.log('AI Formatted Data (first 500 chars):', aiFormattedData.substring(0, 500));
    
    return data;
  } catch (error) {
    console.error('Error testing Excel processing:', error);
    throw error;
  }
};

export default testExcelProcessing;