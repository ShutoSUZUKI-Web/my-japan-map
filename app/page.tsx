"use client";

import React, { useState, useEffect, useRef } from "react";
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

export default function Home() {
  const [activeColor, setActiveColor] = useState(COLORS.red);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedRegionName, setSelectedRegionName] = useState("");
  const [regionData, setRegionData] = useState<Record<string, { color?: string; memo?: string }>>({});
  
  // ★追加: メニューが開いているかどうかの状態管理
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // 初期化
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedData = localStorage.getItem("hokkaido_map_data");
      if (savedData) {
        setRegionData(JSON.parse(savedData));
      }
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

  // 画像保存
  const handleSaveImage = async () => {
    if (!mapRef.current) return;
    
    // 画像保存時はメニューを一時的に閉じる（映り込み防止）
    setIsMenuOpen(false);
    
    // メニューが閉じるアニメーションを少し待ってから撮影
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
            console.error("画像の保存に失敗しました", err);
            alert("画像の保存に失敗しました");
          }
    }, 300);
  };

  const handlePaint = (geo: any) => {
    const uniqueId = geo.rsmKey;
    const cityName = geo.properties.N03_004 || geo.properties.N03_003 || "名称不明";

    setSelectedRegionId(uniqueId);
    setSelectedRegionName(cityName);
    
    // ★変更: エリアをクリックしたら自動でメニューを開く
    setIsMenuOpen(true);

    setRegionData((prev) => {
      const currentData = prev[uniqueId] || { memo: "" };
      if (activeColor === COLORS.eraser) {
        return { ...prev, [uniqueId]: { ...currentData, color: undefined } };
      } else {
        return { ...prev, [uniqueId]: { ...currentData, color: activeColor } };
      }
    });
  };

  const handleMemoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (!selectedRegionId) return;
    setRegionData((prev) => ({
      ...prev,
      [selectedRegionId]: { ...prev[selectedRegionId!], memo: text }
    }));
  };

  return (
    <div style={{ width: "100%", height: "100vh", backgroundColor: "#f0f0f0", position: "relative", overflow: "hidden" }}>
      
      {/* ▼▼▼ 1. 地図エリア ▼▼▼ 
        メニューやボタンはここには含めず、純粋な地図だけを mapRef で囲みます
      */}
      <div 
        ref={mapRef}
        style={{ width: "100%", height: "100%" }}
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


      {/* ▼▼▼ 2. メニューを開くボタン（画面右上に固定） ▼▼▼ 
      */}
      {!isMenuOpen && (
        <button
          onClick={() => setIsMenuOpen(true)}
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 100,
            backgroundColor: "white",
            padding: "12px 16px",
            borderRadius: "50px", // 丸っこくする
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            fontWeight: "bold",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "5px"
          }}
        >
          <span>🎨</span>
          <span>メニュー</span>
        </button>
      )}


      {/* ▼▼▼ 3. 背景を暗くするオーバーレイ（メニューが開いている時だけ） ▼▼▼ 
      */}
      {isMenuOpen && (
        <div
          onClick={() => setIsMenuOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.4)",
            zIndex: 101,
            backdropFilter: "blur(2px)" // 少しぼかすとおしゃれ
          }}
        />
      )}


      {/* ▼▼▼ 4. 右から出てくるスライドメニュー本体 ▼▼▼ 
      */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "85%", // スマホ向けに幅広に
          maxWidth: "350px", // PCで広がりすぎないように制限
          height: "100%",
          backgroundColor: "white",
          boxShadow: "-5px 0 15px rgba(0,0,0,0.1)",
          zIndex: 102,
          padding: "20px",
          overflowY: "auto",
          transition: "transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)", // シュッと動くアニメーション
          transform: isMenuOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* メニューヘッダー：閉じるボタン */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#333" }}>設定 & メモ</h2>
          <button
            onClick={() => setIsMenuOpen(false)}
            style={{
              background: "#f0f0f0",
              border: "none",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              cursor: "pointer",
              fontSize: "16px",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >
            ✕
          </button>
        </div>

        {/* コンテンツ1：選択中のエリアとメモ（選択時のみ表示） */}
        {selectedRegionId && (
          <div style={{ marginBottom: "25px", borderBottom: "1px solid #eee", paddingBottom: "20px" }}>
            <div style={{ fontSize: "12px", color: "#888", marginBottom: "5px" }}>選択中のエリア</div>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "20px", color: "#3B82F6" }}>{selectedRegionName}</h3>
            <textarea
              value={regionData[selectedRegionId]?.memo || ""}
              onChange={handleMemoChange}
              placeholder={`${selectedRegionName} の思い出やメモを入力...`}
              style={{
                width: "100%",
                height: "120px",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ddd",
                resize: "none",
                fontSize: "14px",
                fontFamily: "inherit"
              }}
            />
          </div>
        )}

        {/* コンテンツ2：ペン選択 */}
        <div style={{ marginBottom: "25px" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#666" }}>塗る色を選ぶ</h3>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {[COLORS.red, COLORS.blue, COLORS.yellow, COLORS.green].map((color) => (
              <button
                key={color}
                onClick={() => setActiveColor(color)}
                style={{
                  width: 40,
                  height: 40,
                  background: color,
                  border: activeColor === color ? "3px solid #333" : "3px solid transparent",
                  borderRadius: "50%",
                  cursor: "pointer",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                  transition: "transform 0.1s"
                }}
              />
            ))}
            <button
              onClick={() => setActiveColor(COLORS.eraser)}
              style={{
                padding: "0 15px",
                fontSize: "13px",
                cursor: "pointer",
                border: activeColor === COLORS.eraser ? "2px solid #333" : "1px solid #ccc",
                background: "#f9f9f9",
                borderRadius: "20px",
                height: "40px"
              }}
            >
              消しゴム
            </button>
          </div>
          <p style={{fontSize: "12px", color: "#999", marginTop: "5px"}}>現在: {activeColor === COLORS.eraser ? "消しゴム" : "ペン"}</p>
        </div>

        {/* コンテンツ3：保存・読み込みアクション */}
        <div style={{ borderTop: "1px solid #eee", paddingTop: "20px" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#666" }}>保存・共有</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              onClick={handleSaveImage}
              style={{
                padding: "12px",
                fontSize: "14px",
                cursor: "pointer",
                background: "#3B82F6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: "bold",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
              }}
            >
              📷 画像としてダウンロード
            </button>

            <button onClick={handleExportData} style={{ padding: "10px", fontSize: "13px", cursor: "pointer", background: "#333", color: "white", border: "none", borderRadius: "8px" }}>
              ↓ データをファイル保存 (バックアップ)
            </button>
            
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: "10px", fontSize: "13px", cursor: "pointer", background: "#fff", border: "1px solid #333", borderRadius: "8px", color: "#333" }}>
              ↑ データを読み込み (復元)
            </button>
            <input type="file" ref={fileInputRef} style={{ display: "none" }} accept=".json" onChange={handleImportData} />
          </div>
        </div>

      </div>
    </div>
  );
}