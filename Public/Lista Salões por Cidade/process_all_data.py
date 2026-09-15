import pandas as pd
import re
import numpy as np
import os
import glob
import json
import urllib.request

# Função para buscar coluna ignorando maiúsculas/minúsculas e variações
def get_col(df, candidates):
    cols_map = {str(c).lower().strip(): c for c in df.columns}
    for cand in candidates:
        if cand.lower().strip() in cols_map:
            return cols_map[cand.lower().strip()]
    return None

# Função para extrair o telefone limpo da coluna 'phone' ou 'WhatsApp'
def formatar_whatsapp(telefone):
    if pd.isna(telefone):
        return None
    numeros = re.sub(r'\D', '', str(telefone))
    if len(numeros) >= 10 and not numeros.startswith('55'):
        numeros = '55' + numeros
    return numeros if len(numeros) >= 10 else None

# Função para converter as categorias em Array do PostgreSQL
def formatar_categorias(categoria_raw):
    if pd.isna(categoria_raw):
        return ["Geral"]
    categorias = [c.strip().replace('"', '') for c in str(categoria_raw).split(',')]
    categorias = [c for c in categorias if c]
    return categorias if categorias else ["Geral"]

# Mapeia colunas de forma tolerante a erros de digitação (ex: 'Longetude', 'longetude', 'longitude')
def mapear_colunas(df, nome_arquivo):
    df_clean = pd.DataFrame()
    
    # 1. Nome
    c_nome = get_col(df, ['nome', 'title', 'name'])
    df_clean['nome'] = df[c_nome].fillna('Sem Nome') if c_nome else 'Sem Nome'
    
    # 2. WhatsApp
    c_phone = get_col(df, ['phone', 'whatsapp', 'telefone', 'phoneunformatted'])
    df_clean['whatsapp'] = df[c_phone].apply(formatar_whatsapp) if c_phone else None
    
    # 3. Endereço
    c_end = get_col(df, ['address', 'endereço', 'endereco', 'rua'])
    df_clean['endereco'] = df[c_end] if c_end else None
    
    # 4. Cidade
    c_cid = get_col(df, ['cidade', 'city'])
    if c_cid:
        raw_cidade = df[c_cid].astype(str)
    else:
        match = re.search(r'saloes\s+([A-Za-zÀ-ÿ\s]+)(?:_|-)', nome_arquivo, re.IGNORECASE)
        cidade_extraida = match.group(1).strip() if match else "Desconhecida"
        raw_cidade = pd.Series([cidade_extraida] * len(df))
        
    # Limpa sufixos de estado (ex: "Caxias - MA", "Caxias -MA" -> "Caxias")
    df_clean['cidade'] = raw_cidade.apply(lambda x: re.sub(r'\s*-\s*[A-Za-z]{2}$', '', str(x).strip()))
        
    # 5. Latitude
    c_lat = get_col(df, ['latitude', 'lat', 'location/lat'])
    df_clean['latitude'] = pd.to_numeric(df[c_lat], errors='coerce') if c_lat else np.nan
    
    # 6. Longitude (inclui 'longetude' com E!)
    c_long = get_col(df, ['longitude', 'longetude', 'location/lng', 'lng', 'long'])
    df_clean['longitude'] = pd.to_numeric(df[c_long], errors='coerce') if c_long else np.nan
    
    # 7. Categorias
    c_cat = get_col(df, ['categoria', 'categoryname', 'category', 'categories'])
    if c_cat:
        df_clean['categorias'] = df[c_cat].apply(formatar_categorias)
    else:
        df_clean['categorias'] = [["Geral"]] * len(df)
        
    # 8. URL e Funil
    c_url = get_col(df, ['url', 'url_maps', 'maps_url', 'link'])
    df_clean['url_maps'] = df[c_url] if c_url else None
    df_clean['status_funil'] = 'prospect'
    
    return df_clean

# Execução Principal: Varre a pasta
arquivos_encontrados = [
    f for f in (glob.glob("*.csv") + glob.glob("*.xlsx"))
    if not f.startswith("BASE_") and not f.startswith("importacao_")
]
dataframes_limpos = []

print(f"Processando {len(arquivos_encontrados)} arquivos com deteccao inteligente de colunas...")

for arquivo in arquivos_encontrados:
    try:
        if arquivo.endswith('.csv'):
            df_bruto = pd.read_csv(arquivo)
        else:
            df_bruto = pd.read_excel(arquivo)
            
        df_padronizado = mapear_colunas(df_bruto, arquivo)
        com_coords = df_padronizado['latitude'].notna() & df_padronizado['longitude'].notna()
        dataframes_limpos.append(df_padronizado)
        print(f"OK: {arquivo} -> {len(df_padronizado)} saloes ({com_coords.sum()} com coordenadas validas)")
    except Exception as e:
        print(f"ERRO em {arquivo}: {e}")

if dataframes_limpos:
    df_master = pd.concat(dataframes_limpos, ignore_index=True)
    
    # Exporta CSV para Supabase
    df_csv = df_master.copy()
    df_csv['categorias'] = df_csv['categorias'].apply(lambda l: "{" + ",".join(f'"{c}"' for c in l) + "}")
    arquivo_saida = "BASE_CLIENTES_MASTER_SUPABASE.csv"
    df_csv.to_csv(arquivo_saida, index=False, na_rep='')
    print(f"\nCSV atualizado salvo em: {arquivo_saida}")
    
    total = len(df_master)
    validos = (df_master['latitude'].notna() & df_master['longitude'].notna()).sum()
    print(f"Total: {total} saloes, sendo {validos} COM COORDENADAS COMPLETAS (Lat + Long)!")
else:
    print("Nenhum arquivo processado.")
