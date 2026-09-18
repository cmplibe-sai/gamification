import sys
import urllib.request
import zipfile
import io
import json
import xml.etree.ElementTree as ET

def get_rich_text_map(sheet_id):
    url = f'https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = resp.read()

    with zipfile.ZipFile(io.BytesIO(data)) as z:
        sst_root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        strings = []
        ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        for si in sst_root.findall('ns:si', ns):
            parts = []
            for elem in si:
                tag = elem.tag.split('}')[-1]
                if tag == 't':
                    parts.append(elem.text or '')
                elif tag == 'r':
                    rPr = elem.find('ns:rPr', ns)
                    is_bold = rPr is not None and rPr.find('ns:b', ns) is not None
                    is_italic = rPr is not None and rPr.find('ns:i', ns) is not None
                    t = elem.find('ns:t', ns)
                    text = t.text if t is not None and t.text else ''
                    if is_bold and is_italic:
                        parts.append(f'***{text}***')
                    elif is_bold:
                        parts.append(f'**{text}**')
                    elif is_italic:
                        parts.append(f'*{text}*')
                    else:
                        parts.append(text)
            strings.append(''.join(parts))

        sheet_root = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        rows = []
        for row in sheet_root.findall('.//ns:row', ns):
            row_vals = []
            for c in row.findall('ns:c', ns):
                t_attr = c.get('t')
                v_elem = c.find('ns:v', ns)
                val = ''
                if v_elem is not None and v_elem.text:
                    if t_attr == 's':
                        idx = int(v_elem.text)
                        if idx < len(strings):
                            val = strings[idx]
                    else:
                        val = v_elem.text
                elif t_attr == 'inlineStr':
                    is_elem = c.find('ns:is', ns)
                    if is_elem is not None:
                        t = is_elem.find('ns:t', ns)
                        val = t.text if t is not None and t.text else ''
                row_vals.append(val)
            if any(row_vals):
                rows.append(row_vals)

    res_map = {}
    if len(rows) > 1:
        headers = [h.lower().strip() for h in rows[0]]
        title_idx = -1
        desc_idx = -1
        for i, h in enumerate(headers):
            if 'title' in h or 'topic' in h: title_idx = i
            elif 'description' in h or 'article' in h: desc_idx = i
        
        for r in rows[1:]:
            title = r[title_idx].strip() if title_idx < len(r) and title_idx != -1 else ''
            desc = r[desc_idx].strip() if desc_idx < len(r) and desc_idx != -1 else ''
            if title and desc:
                clean_t = ''.join(c for c in title.lower() if c.isalnum())
                res_map[clean_t] = desc

    return res_map

if __name__ == '__main__':
    sheet_id = sys.argv[1] if len(sys.argv) > 1 else '1uiiUiqJ-_wtOzbtBZwFuaOS0C6NlV405ZE4RCdTy7VU'
    try:
        data = get_rich_text_map(sheet_id)
        print(json.dumps(data))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
