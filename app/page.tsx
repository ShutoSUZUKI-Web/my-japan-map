"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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

// ★高速化1: 地図のパーツ（1つの市町村）を独立した部品にして、無駄な再描画を防ぐ
const MapRegion = React.memo(({ geo, data, isSelected, activeColor, onPaint }: any) => {
  const regionColor = data?.color || "#D6D6DA";
  // data-tipなどはスマホで重くなる原因になるので削除し、シンプルに
  return (
    <Geography
      geography={geo}
      fill={regionColor}
      stroke={isSelected ? "#333" : "#FFF"}
      strokeWidth={isSelected ? 1.5 : 0.5}
      style={{
        default: { outline: "none" },
        hover: { fill: regionColor, opacity: 0.8, outline: "none" }, // スマホはhover不要だがPC用に残す
        pressed: { outline: "none" },
      }}
      onClick={(e) => {
        e.stopPropagation();
        onPaint(geo);
      }}
    />
  );
}, (prev, next) => {
  // 再描画するかどうかの判定（色が同じで選択状態も変わらなければ何もしない）
  return (
    prev.data?.color === next.data?.color &&
    prev.isSelected === next.isSelected &&
    prev.activeColor === next.activeColor // ※ペンを変えた時はカーソル表現のため再描画
  );
});

export default function Home() {
  const [activeColor, setActiveColor] = useState(COLORS.red);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedRegionName, setSelectedRegionName] = useState("");
  const [regionData, setRegionData] = useState<Record<string, { color?: string; memo?: string }>>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

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

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setRegionData(json);
        alert("データを読み込みました！");
      } catch (error) {
        alert("読み込み失敗");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveImage = async () => {
    if (!mapRef.current) return;
    setIsMenuOpen(false);
    setTimeout(async () => {
        try {
            const canvas = await html2canvas(mapRef.current!, {
              backgroundColor: "#f0f0f0",
              scale: 2,
            });
            const image = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = image;
            link.download = "my_hokkaido_map.png";
            link.click();
          } catch (err) {
            alert("保存失敗");
          }
    }, 300);
  };

  // useCallbackで関数の再生成を防ぐ
  const handlePaint = React.useCallback((geo: any) => {
    const uniqueId = geo.rsmKey;
    const cityName = geo.properties.N03_004 || geo.properties.N03_003 || "名称不明";

    setSelectedRegionId(uniqueId);
    setSelectedRegionName(cityName);
    setIsMenuOpen(true);

    setRegionData((prev) => {
      const currentData = prev[uniqueId] || { memo: "" };
      // State更新関数内で現在のactiveColorを参照するためには、
      // 依存配列にactiveColorを入れるか、Refを使う必要がありますが、
      // ここでは外側のactiveColorを参照します（後述の依存配列で制御）
      if (activeColor === COLORS.eraser) {
        return { ...prev, [uniqueId]: { ...currentData, color: undefined } };
      } else {
        return { ...prev, [uniqueId]: { ...currentData, color: activeColor } };
      }
    });
  }, [activeColor]); // activeColorが変わった時だけ関数を作り直す

  const handleMemoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (!selectedRegionId) return;
    setRegionData((prev) => ({
      ...prev,
      [selectedRegionId]: { ...prev[selectedRegionId!], memo: text }
    }));
  };

  // ★高速化2: 地図全体を useMemo で囲む
  // これにより「メニューの開閉(isMenuOpen)」が変わっても、地図は再描画されなくなる！
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
                  data={regionData[geo.rsmKey]}
                  isSelected={selectedRegionId === geo.rsmKey}
                  activeColor={activeColor}
                  onPaint={handlePaint}
                />
              ))
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    );
  }, [regionData, selectedRegionId, activeColor, handlePaint]); 
  // ↑ ここに isMenuOpen が入っていないのがポイント！

  return (
    <div style={{ width: "100%", height: "100vh", backgroundColor: "#f0f0f0", position: "relative", overflow: "hidden" }}>
      
      {/* 地図表示エリア */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }}>
        {mapContent}
      </div>

      {/* メニューを開くボタン */}
      {!isMenuOpen && (
        <button
          onClick={() => setIsMenuOpen(true)}
          style={{
            position: "fixed",
            top: "20px", right: "20px", zIndex: 100,
            backgroundColor: "white", padding: "12px 16px",
            borderRadius: "50px", boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            fontWeight: "bold", border: "none", cursor: "pointer",
            fontSize: "14px", display: "flex", alignItems: "center", gap: "5px"
          }}
        >
          <span>🎨</span><span>メニュー</span>
        </button>
      )}

      {/* 背景オーバーレイ（★高速化3: 重いbackdrop-filterを削除） */}
      {isMenuOpen && (
        <div
          onClick={() => setIsMenuOpen(false)}
          style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            backgroundColor: "rgba(0,0,0,0.3)", // 半透明の黒のみ
            zIndex: 101,
          }}
        />
      )}

      {/* スライドメニュー */}
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
              width: "32px", height: "32px", cursor: "pointer",
              fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center"
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
                borderRadius: "8px", border: "1px solid #ddd", resize: "none",
                fontSize: "16px" // スマホでズームしないフォントサイズ
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
                  borderRadius: "50%", cursor: "pointer",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
                }}
              />
            ))}
            <button
              onClick={() => setActiveColor(COLORS.eraser)}
              style={{
                padding: "0 15px", fontSize: "13px", cursor: "pointer",
                border: activeColor === COLORS.eraser ? "2px solid #333" : "1px solid #ccc",
                background: "#f9f9f9", borderRadius: "20px", height: "40px"
              }}
            >
              消しゴム
            </button>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #eee", paddingTop: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              onClick={handleSaveImage}
              style={{
                padding: "12px", fontSize: "14px", cursor: "pointer",
                background: "#3B82F6", color: "white", border: "none",
                borderRadius: "8px", fontWeight: "bold"
              }}
            >
              📷 画像保存
            </button>
            <button onClick={handleExportData} style={{ padding: "10px", fontSize: "13px", cursor: "pointer", background: "#333", color: "white", border: "none", borderRadius: "8px" }}>
              ↓ バックアップ保存
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: "10px", fontSize: "13px", cursor: "pointer", background: "#fff", border: "1px solid #333", borderRadius: "8px", color: "#333" }}>
              ↑ データ復元
            </button>
            <input type="file" ref={fileInputRef} style={{ display: "none" }} accept=".json" onChange={handleImportData} />
          </div>
        </div>
      </div>
    </div>
  );
}