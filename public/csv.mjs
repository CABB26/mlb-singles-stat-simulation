// RFC 4180-style CSV, including BOM, escaped quotes and multiline fields.
export function parseCSV(text) {
  if (text.length > 5_000_000) throw new Error('CSV exceeds the 5 MB limit.');
  text = text.replace(/^\uFEFF/,'');
  const rows=[]; let row=[],field='',quoted=false,closed=false;
  const pushField=()=>{row.push(field);field='';closed=false;};
  const pushRow=()=>{pushField();if(row.some(v=>v.trim()!==''))rows.push(row);row=[];};
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) {if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
    if(c==='"'){if(field || closed)throw new Error('Malformed CSV quote.');quoted=true;}
    else if(c===',')pushField();
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;pushRow();}
    else if(closed){if(c!==' '&&c!=='\t')throw new Error('Unexpected text after a quoted CSV field.');}
    else field+=c;
  }
  if(quoted)throw new Error('CSV contains an unclosed quote.');
  if(field||row.length||closed)pushRow();
  if(rows.length<2)throw new Error('CSV needs a header and at least one data row.');
  const headers=rows.shift().map(v=>v.trim());
  if(headers.some(v=>!v)||new Set(headers).size!==headers.length)throw new Error('CSV has blank or duplicate column names.');
  return rows.map((values,i)=>{if(values.length!==headers.length)throw new Error(`CSV row ${i+2} has ${values.length} fields; expected ${headers.length}.`);return Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()]));});
}
export const number = value => value===undefined || value===null || String(value).trim()==='' || !Number.isFinite(Number(value)) ? null : Number(value);
