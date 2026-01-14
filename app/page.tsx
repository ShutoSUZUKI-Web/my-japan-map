"use client";

import React, { useState, useEffect, useRef } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
// ★追加: 撮影用ライブラリ
import html2canvas from "html2canvas";

const GEO_URL = "/Hokkaidomap.json";

const COLORS = {
  red: "#EF4444",
  blue: "#3B82F6",
  yellow: "#EAB308",
  green: "#22C55E",
  eraser: "#D6D6DA"
};

export default function Home() {
  const [activeColor, setActiveColor] = useState(COLORS.red);
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  const [selectedRegionName, setSelectedRegionName] = useState("");
  const [regionData, setRegionData] = useState({});
  
  const fileInputRef = useRef(null);
  // ★追加: 地図エリアを特定するための参照（ref）
  const mapRef = useRef(null);

  // 初期化
  useEffect(() => {
    const savedData = localStorage.getItem("hokkaido_map_data");
    if (savedData) {
      setRegionData(JSON.parse(savedData));
    }
  }, []);

  // 自動保存
  useEffect(() => {
    if (Object.keys(regionData).length > 0) {
      localStorage.setItem("hokkaido_map_data", JSON.stringify(regionData));
    }
  }, [regionData]);

  // JSONエクスポート
  const handleExportData = () => {
    const jsonString = JSON.stringify(regionData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hokkaido_map_data.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // JSONインポート
  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        setRegionData(json);
        alert("データを読み込みました！");
      } catch (error) {
        alert("読み込み失敗");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ★追加: 画像として保存する機能
  const handleSaveImage = async () => {
    if (!mapRef.current) return;

    try {
      // 地図エリア(mapRef)を撮影
      const canvas = await html2canvas(mapRef.current, {
        backgroundColor: "#f0f0f0", // 背景色を指定
        scale: 2, // 高画質にする（2倍解像度）
      });

      // 画像リンクを作成してダウンロード
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = "my_hokkaido_map.png";
      link.click();
    } catch (err) {
      console.error("画像の保存に失敗しました", err);
      alert("画像の保存に失敗しました");
    }
  };

  const handlePaint = (geo) => {
    const uniqueId = geo.rsmKey;
    // Mapshaperで確認したキー名に合わせて調整してください
    const cityName = geo.properties.N03_004 || geo.properties.N03_003 || "名称不明";

    setSelectedRegionId(uniqueId);
    setSelectedRegionName(cityName);

    setRegionData((prev) => {
      const currentData = prev[uniqueId] || { memo: "" };
      if (activeColor === COLORS.eraser) {
        return { ...prev, [uniqueId]: { ...currentData, color: undefined } };
      } else {
        return { ...prev, [uniqueId]: { ...currentData, color: activeColor } };
      }
    });
  };

  const handleMemoChange = (e) => {
    const text = e.target.value;
    if (!selectedRegionId) return;
    setRegionData((prev) => ({
      ...prev,
      [selectedRegionId]: { ...prev[selectedRegionId], memo: text }
    }));
  };

  return (
    <div style={{ width: "100%", height: "100vh", backgroundColor: "#f0f0f0", position: "relative", display: "flex" }}>
      
      {/* 操作パネル */}
      <div style={{ 
        position: "absolute", top: 20, left: 20, zIndex: 100, 
        background: "white", padding: "15px", borderRadius: "8px", 
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", gap: "15px"
      }}>
        {/* ペン選択 */}
        <div>
          <h3 style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#666" }}>ペン</h3>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {[COLORS.red, COLORS.blue, COLORS.yellow, COLORS.green].map((color) => (
              <button 
                key={color}
                onClick={() => setActiveColor(color)} 
                style={{ 
                  width: 30, height: 30, background: color, 
                  border: activeColor === color ? "3px solid black" : "1px solid #ddd", 
                  borderRadius: "50%", cursor: "pointer" 
                }} 
              />
            ))}
            <button 
              onClick={() => setActiveColor(COLORS.eraser)} 
              style={{ padding: "0 8px", fontSize: "12px", cursor: "pointer", border: "1px solid #ccc", background: activeColor === COLORS.eraser ? "#eee" : "#fff", borderRadius: "4px" }}
            >
              消しゴム
            </button>
          </div>
        </div>

        {/* 共有・保存メニュー */}
        <div style={{ borderTop: "1px solid #eee", paddingTop: "10px" }}>
          <h3 style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#666" }}>共有・保存</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* ★追加: 画像保存ボタン */}
            <button 
              onClick={handleSaveImage}
              style={{ padding: "8px", fontSize: "12px", cursor: "pointer", background: "#3B82F6", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}
            >
              📷 画像として保存 
            </button>

            <button onClick={handleExportData} style={{ padding: "6px", fontSize: "12px", cursor: "pointer", background: "#333", color: "white", border: "none", borderRadius: "4px" }}>
              ↓ データを保存 (バックアップ)
            </button>
            <button onClick={() => fileInputRef.current.click()} style={{ padding: "6px", fontSize: "12px", cursor: "pointer", background: "#fff", border: "1px solid #333", borderRadius: "4px" }}>
              ↑ データを読込 (復元)
            </button>
            <input type="file" ref={fileInputRef} style={{ display: "none" }} accept=".json" onChange={handleImportData} />
          </div>
        </div>
      </div>

      {/* メイン：地図エリア */}
      {/* ★修正: mapRefをここにつけて、このdivの中身を撮影するようにする */}
      <div 
        ref={mapRef}
        style={{ flex: 1, position: "relative", backgroundColor: "#f0f0f0" }} // 背景色を明示的に指定
      >
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [142.5, 43.5], scale: 3500 }}
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const uniqueId = geo.rsmKey;
                  const data = regionData[uniqueId];
                  const regionColor = data?.color || "#D6D6DA";
                  // 市町村名取得ロジック
                  const cityName = geo.properties.N03_004 || geo.properties.N03_003 || "";
                  const isSelected = selectedRegionId === uniqueId;

                  return (
                    <Geography
                      key={uniqueId}
                      geography={geo}
                      fill={regionColor}
                      stroke={isSelected ? "#000" : "#FFF"}
                      strokeWidth={isSelected ? 1.5 : 0.5}
                      style={{
                        default: { outline: "none" },
                        hover: { fill: activeColor, opacity: 0.7, outline: "none", cursor: "pointer" },
                        pressed: { outline: "none" },
                      }}
                      // ツールチップ的にタイトルを表示
                      data-tip={cityName}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePaint(geo);
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* 右側：メモ編集サイドバー */}
      {selectedRegionId && (
        <div style={{ 
          width: "300px", background: "white", borderLeft: "1px solid #ccc", 
          padding: "20px", display: "flex", flexDirection: "column",
          boxShadow: "-2px 0 10px rgba(0,0,0,0.05)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2 style={{ fontSize: "18px", margin: 0 }}>{selectedRegionName}</h2>
            <button onClick={() => setSelectedRegionId(null)} style={{ cursor: "pointer", border:"none", background:"transparent", fontSize:"20px" }}>×</button>
          </div>
          <p style={{ fontSize: "12px", color: "#666", marginBottom: "10px" }}>ID: {selectedRegionId}</p>
          <textarea
            value={regionData[selectedRegionId]?.memo || ""}
            onChange={handleMemoChange}
            placeholder={`${selectedRegionName} のメモを入力...`}
            style={{ 
              width: "100%", height: "200px", padding: "10px", 
              borderRadius: "4px", border: "1px solid #ddd", resize: "none"
            }}
          />
        </div>
      )}
    </div>
  );
}