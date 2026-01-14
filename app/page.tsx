"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import html2canvas from "html2canvas";

const GEO_URL = "/Hokkaidomap.json";

const COLORS = {
  red: "#EF4444",
  blue: "#3B82F6",
  yellow: "#EAB308",
  green: "#22C55E",
  eraser: "#D6D6DA",
};

// --- 高速化のための部品（変更なし） ---
const MapRegion = React.memo(({ geo, regionColor, isSelected, onPaint }: any) => {
  return (
    <Geography
      geography={geo}
      fill={regionColor}
      stroke={isSelected ? "#333" : "#FFF"}
      strokeWidth={isSelected ? 1.0 : 0.3}
      style={{
        default: { outline: "none" },
        hover: { fill: regionColor, outline: "none" },
        pressed: { outline: "none" },
      }}
      onClick={(e) => {
        e.stopPropagation();
        onPaint(geo);
      }}
    />
  );
}, (prev, next) => {
  return prev.regionColor === next.regionColor && prev.isSelected === next.isSelected;
});

export default function Home() {
  const [activeColor, setActiveColor] = useState(COLORS.red);
  const activeColorRef = useRef(COLORS.red);

  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedRegionName, setSelectedRegionName] = useState("");
  const [regionData, setRegionData] = useState<Record<string, { color?: string; memo?: string }>>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeColorRef.current = activeColor;
  }, [activeColor]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedData = localStorage.getItem("hokkaido_map_data");
      if (savedData) {
        setRegionData(JSON.parse(savedData));
      }
    }
  }, []);

  useEffect(() => {
    if (Object.keys(regionData).length > 0) {
      localStorage.setItem("hokkaido_map_data", JSON.stringify(regionData));
    }
  }, [regionData]);

  // ★変更点1: データ保存時に名前を聞くように修正
  const handleExportData = () => {
    // ポップアップで名前を入力させる
    const fileNameInput = window.prompt("保存するファイル名を入力してください", "hokkaido_map_data");
    
    // キャンセルされたら何もしない
    if (!fileNameInput) return;

    // ".json" がついていなければ付ける
    const fileName = fileNameInput.endsWith(".json") ? fileNameInput : `${fileNameInput}.json`;

    const jsonString = JSON.stringify(regionData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName; // 入力された名前を使用
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setRegionData(json);
        alert("読み込み完了");
      } catch (error) {
        alert("失敗");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ★変更点2: 画像保存時も名前を聞くように修正
  const handleSaveImage = async () => {
    if (!mapRef.current) return;

    // ここで名前を聞く
    const fileNameInput = window.prompt("画像のファイル名を入力してください", "my_hokkaido_map");
    if (!fileNameInput) return; // キャンセルなら中止

    const fileName = fileNameInput.endsWith(".png") ? fileNameInput : `${fileNameInput}.png`;

    setIsMenuOpen(false);
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(mapRef.current!, { backgroundColor: "#f0f0f0", scale: 2 });
        const image = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = image;
        link.download = fileName; // 入力された名前を使用
        link.click();
      } catch (err) {
        alert("画像の保存に失敗しました");
      }
    }, 300);
  };

  const handlePaint = useCallback((geo: any) => {
    const uniqueId = geo.rsmKey;
    const cityName = geo.properties.N03_004 || geo.properties.N03_003 || "名称不明";

    setSelectedRegionId(uniqueId);
    setSelectedRegionName(cityName);
    setIsMenuOpen(true);

    const currentColor = activeColorRef.current;

    setRegionData((prev) => {
      const currentData = prev[uniqueId] || { memo: "" };
      if (currentColor === COLORS.eraser) {
        return { ...prev, [uniqueId]: { ...currentData, color: undefined } };
      } else {
        return { ...prev, [uniqueId]: { ...currentData, color: currentColor } };
      }
    });
  }, []);

  const handleMemoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (!selectedRegionId) return;
    setRegionData((prev) => ({
      ...prev,
      [selectedRegionId]: { ...prev[selectedRegionId!], memo: text }
    }));
  };

  const mapContent = useMemo(() => {
    return (
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [142.5, 43.5], scale: 3500 }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <MapRegion
                  key={geo.rsmKey}
                  geo={geo}
                  regionColor={regionData[geo.rsmKey]?.color || "#D6D6DA"}
                  isSelected={selectedRegionId === geo.rsmKey}
                  onPaint={handlePaint}
                />
              ))
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    );
  }, [regionData, selectedRegionId, handlePaint]);

  return (
    <div style={{ width: "100%", height: "100vh", backgroundColor: "#f0f0f0", position: "relative", overflow: "hidden" }}>
      
      <div ref={mapRef} style={{ width: "100%", height: "100%" }}>
        {mapContent}
      </div>

      {!isMenuOpen && (
        <button
          onClick={() => setIsMenuOpen(true)}
          style={{
            position: "fixed", top: "20px", right: "20px", zIndex: 100,
            backgroundColor: "white", padding: "12px 16px", borderRadius: "50px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)", fontWeight: "bold", border: "none",
            fontSize: "14px", display: "flex", alignItems: "center", gap: "5px"
          }}
        >
          <span>🎨</span><span>メニュー</span>
        </button>
      )}

      {isMenuOpen && (
        <div
          onClick={() => setIsMenuOpen(false)}
          style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            backgroundColor: "rgba(0,0,0,0.3)", zIndex: 101,
          }}
        />
      )}

      <div
        style={{
          position: "fixed", top: 0, right: 0,
          width: "85%", maxWidth: "350px", height: "100%",
          backgroundColor: "white",
          boxShadow: "-5px 0 15px rgba(0,0,0,0.1)",
          zIndex: 102, padding: "20px", overflowY: "auto",
          transition: "transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
          transform: isMenuOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#333" }}>設定 & メモ</h2>
          <button
            onClick={() => setIsMenuOpen(false)}
            style={{
              background: "#f0f0f0", border: "none", borderRadius: "50%",
              width: "32px", height: "32px", fontSize: "16px"
            }}
          >
            ✕
          </button>
        </div>

        {selectedRegionId && (
          <div style={{ marginBottom: "25px", borderBottom: "1px solid #eee", paddingBottom: "20px" }}>
            <div style={{ fontSize: "12px", color: "#888", marginBottom: "5px" }}>選択中のエリア</div>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "20px", color: "#3B82F6" }}>{selectedRegionName}</h3>
            <textarea
              value={regionData[selectedRegionId]?.memo || ""}
              onChange={handleMemoChange}
              placeholder="メモを入力..."
              style={{
                width: "100%", height: "100px", padding: "10px",
                borderRadius: "8px", border: "1px solid #ddd", resize: "none", fontSize: "16px"
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: "25px" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#666" }}>塗る色</h3>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {[COLORS.red, COLORS.blue, COLORS.yellow, COLORS.green].map((color) => (
              <button
                key={color}
                onClick={() => setActiveColor(color)}
                style={{
                  width: 40, height: 40, background: color,
                  border: activeColor === color ? "3px solid #333" : "3px solid transparent",
                  borderRadius: "50%"
                }}
              />
            ))}
            <button
              onClick={() => setActiveColor(COLORS.eraser)}
              style={{
                padding: "0 15px", fontSize: "13px",
                border: activeColor === COLORS.eraser ? "2px solid #333" : "1px solid #ccc",
                background: "#f9f9f9", borderRadius: "20px", height: "40px"
              }}
            >
              消しゴム
            </button>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #eee", paddingTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <button onClick={handleSaveImage} style={{ padding: "12px", fontSize: "14px", background: "#3B82F6", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold" }}>📷 画像保存 (名前付き)</button>
            <button onClick={handleExportData} style={{ padding: "10px", fontSize: "13px", background: "#333", color: "white", border: "none", borderRadius: "8px" }}>↓ バックアップ保存 (名前付き)</button>
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: "10px", fontSize: "13px", background: "#fff", border: "1px solid #333", borderRadius: "8px", color: "#333" }}>↑ データ復元</button>
            <input type="file" ref={fileInputRef} style={{ display: "none" }} accept=".json" onChange={handleImportData} />
        </div>
      </div>
    </div>
  );
}