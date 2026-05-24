import React from "react";

export default function FrontPage({ onStart, fading }) {
    

  
  return (
     <section className={`hero${fading ? " is-fading" : ""}`}>

    <div
      style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          //backgroundColor: "#f0f0f0",
        }}
        >
      <h1 style={{ fontSize: "5em", marginBottom: "40px" }}>
        A Changing Arctic Ocean
      </h1>
      <p style={{ fontSize: "2em", textAlign: "center", maxWidth: "700px" }}>
        Explore the  Arctic Ocean through our interactive storytelling visualization. Dive into the unique features, ecosystems, and challenges of this remote and captivating region.
      </p>

      <button
          className="captive-cta"
          onClick={onStart}
          aria-label="Jump into the story"
          >
          Explore The Story
        </button>

    </div>
            </section>
  );
}       


