import * as XLSX from 'xlsx';

export interface SheetData {
  name: string;
  data: any[][];
  headers: string[];
  rowCount: number;
  columnCount: number;
}

export interface ExcelData {
  sheets: SheetData[];
  sheetNames: string[];
  summary: string;
}

export class ExcelProcessor {
  private static instance: ExcelProcessor;
  private cachedData: ExcelData | null = null;

  private constructor() {}

  public static getInstance(): ExcelProcessor {
    if (!ExcelProcessor.instance) {
      ExcelProcessor.instance = new ExcelProcessor();
    }
    return ExcelProcessor.instance;
  }

  public async processExcelFile(file: File): Promise<ExcelData> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const sheets: SheetData[] = [];
      const sheetNames = workbook.SheetNames;

      for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // Extract headers (first row)
        const headers = jsonData.length > 0 ? jsonData[0].map(header => String(header || '')) : [];
        
        // Get data rows (excluding header)
        const dataRows = jsonData.slice(1);
        
        const sheetData: SheetData = {
          name: sheetName,
          data: dataRows,
          headers,
          rowCount: dataRows.length,
          columnCount: headers.length
        };
        
        sheets.push(sheetData);
      }

      const summary = this.generateDataSummary(sheets);
      
      const excelData: ExcelData = {
        sheets,
        sheetNames,
        summary
      };

      this.cachedData = excelData;
      return excelData;
    } catch (error) {
      console.error('Error processing Excel file:', error);
      throw new Error(`Failed to process Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public getCachedData(): ExcelData | null {
    return this.cachedData;
  }

  private generateDataSummary(sheets: SheetData[]): string {
    let summary = `Excel file contains ${sheets.length} sheet(s):\n\n`;
    
    sheets.forEach((sheet, index) => {
      summary += `Sheet ${index + 1}: "${sheet.name}"\n`;
      summary += `- Rows: ${sheet.rowCount}\n`;
      summary += `- Columns: ${sheet.columnCount}\n`;
      summary += `- Headers: ${sheet.headers.join(', ')}\n`;
      
      // Add sample data for better context
      if (sheet.data.length > 0) {
        summary += `- Sample data (first 3 rows):\n`;
        const sampleRows = sheet.data.slice(0, 3);
        sampleRows.forEach((row, rowIndex) => {
          const rowData = sheet.headers.map((header, colIndex) => 
            `${header}: ${row[colIndex] || 'N/A'}`
          ).join(', ');
          summary += `  Row ${rowIndex + 1}: ${rowData}\n`;
        });
      }
      summary += '\n';
    });
    
    return summary;
  }

  public searchData(query: string, sheets?: SheetData[]): any[] {
    const sheetsToSearch = sheets || this.cachedData?.sheets || [];
    const results: any[] = [];

    sheetsToSearch.forEach(sheet => {
      sheet.data.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (cell && String(cell).toLowerCase().includes(query.toLowerCase())) {
            results.push({
              sheet: sheet.name,
              row: rowIndex + 2, // +2 because we start from 1 and skip header
              column: sheet.headers[colIndex] || `Column ${colIndex + 1}`,
              value: cell,
              context: this.getRowContext(sheet, rowIndex)
            });
          }
        });
      });
    });

    return results;
  }

  private getRowContext(sheet: SheetData, rowIndex: number): Record<string, any> {
    const context: Record<string, any> = {};
    const row = sheet.data[rowIndex];
    
    sheet.headers.forEach((header, colIndex) => {
      context[header] = row[colIndex] || null;
    });
    
    return context;
  }

  public getSheetData(sheetName: string): SheetData | null {
    if (!this.cachedData) return null;
    return this.cachedData.sheets.find(sheet => sheet.name === sheetName) || null;
  }

  public getAllSheetsData(): SheetData[] {
    return this.cachedData?.sheets || [];
  }

  public formatDataForAI(sheets?: SheetData[]): string {
    const sheetsToFormat = sheets || this.cachedData?.sheets || [];
    let formattedData = "Excel Dataset Information:\n\n";

    sheetsToFormat.forEach(sheet => {
      formattedData += `=== Sheet: ${sheet.name} ===\n`;
      formattedData += `Headers: ${sheet.headers.join(' | ')}\n\n`;
      
      // Include first 10 rows for context
      const sampleRows = sheet.data.slice(0, 10);
      sampleRows.forEach((row, index) => {
        const formattedRow = sheet.headers.map((header, colIndex) => 
          `${header}: ${row[colIndex] || 'N/A'}`
        ).join(' | ');
        formattedData += `Row ${index + 1}: ${formattedRow}\n`;
      });
      
      if (sheet.data.length > 10) {
        formattedData += `... and ${sheet.data.length - 10} more rows\n`;
      }
      
      formattedData += '\n';
    });

    return formattedData;
  }
}

export default ExcelProcessor;