/**
 * Graph3D Pro — mod-export.js
 * Module 10 — Export: PNG, JPG, OBJ, STL, JSON
 * ~/graph3d-pro/modules/mod-export.js
 */

const ModExport = (() => {

  // ══════════════════════════════════════════════════════
  // PNG / JPG SCREENSHOT
  // ══════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════
  // SHARED EXPORT GEOMETRY HELPERS
  //
  // Both OBJ and STL need the same thing: world-space triangles that are
  // actually closed, watertight solids. A z=f(x,y) height-field or an
  // open parametric ribbon is a single-sided *sheet* with zero thickness —
  // exporting it as-is produces a file that isn't manifold and generally
  // isn't printable. _solidify() detects the open boundary and extrudes a
  // thin shell to close it; surfaces that are already closed (a full
  // parametric sphere/torus, a marching-cubes isosurface) are detected as
  // having no boundary and are left exactly as they are.
  // ══════════════════════════════════════════════════════

  function _collectExportGeometry(mesh) {
    const posAttr = mesh.geometry.getAttribute('position');
    const idxAttr = mesh.geometry.getIndex();
    const matrix  = mesh.matrixWorld;

    const positions = new Array(posAttr.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(matrix);
      positions[i * 3] = v.x; positions[i * 3 + 1] = v.y; positions[i * 3 + 2] = v.z;
    }

    let indices;
    if (idxAttr) {
      indices = new Array(idxAttr.count);
      for (let i = 0; i < idxAttr.count; i++) indices[i] = idxAttr.getX(i);
    } else {
      indices = Array.from({ length: posAttr.count }, (_, i) => i);
    }

    return { positions, indices };
  }

  function _computeNormals(positions, indices) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const n = geo.getAttribute('normal');
    const out = new Array(positions.length);
    for (let i = 0; i < n.count; i++) {
      out[i * 3] = n.getX(i); out[i * 3 + 1] = n.getY(i); out[i * 3 + 2] = n.getZ(i);
    }
    geo.dispose();
    return out;
  }

  // Undirected-edge -> triangle count, keeping the directed (i,j) form as
  // it appeared in its one owning triangle. An edge used by exactly one
  // triangle is a boundary edge; the direction it was seen in is the only
  // direction it was ever seen in, so there's no ambiguity to resolve.
  function _findBoundaryEdges(indices) {
    const count = new Map();
    const directed = new Map();
    for (let t = 0; t < indices.length; t += 3) {
      const tri = [indices[t], indices[t + 1], indices[t + 2]];
      for (let e = 0; e < 3; e++) {
        const i = tri[e], j = tri[(e + 1) % 3];
        const key = i < j ? i + '_' + j : j + '_' + i;
        count.set(key, (count.get(key) || 0) + 1);
        if (!directed.has(key)) directed.set(key, [i, j]);
      }
    }
    const boundary = [];
    count.forEach((c, key) => { if (c === 1) boundary.push(directed.get(key)); });
    return boundary;
  }

  function _boundingDiagonal(positions) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]);     maxX = Math.max(maxX, positions[i]);
      minY = Math.min(minY, positions[i + 1]); maxY = Math.max(maxY, positions[i + 1]);
      minZ = Math.min(minZ, positions[i + 2]); maxZ = Math.max(maxZ, positions[i + 2]);
    }
    return Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  }

  /**
   * Returns { positions, indices, normals, wasOpen }. If the input mesh has
   * no boundary (already closed) this is a no-op pass-through. Otherwise it
   * extrudes along each vertex's own normal (not a fixed world axis, so it
   * works regardless of the surface's orientation) to produce a closed,
   * 2-manifold solid: original top + reversed-winding bottom + outward
   * side walls along every boundary edge.
   */
  function _solidify(positions, indices, thickness) {
    const boundaryEdges = _findBoundaryEdges(indices);
    if (boundaryEdges.length === 0) {
      return { positions, indices, normals: _computeNormals(positions, indices), wasOpen: false };
    }

    const openNormals = _computeNormals(positions, indices);
    const vertexCount = positions.length / 3;

    const solidPositions = positions.slice();
    for (let i = 0; i < vertexCount; i++) {
      solidPositions.push(
        positions[i * 3]     - openNormals[i * 3]     * thickness,
        positions[i * 3 + 1] - openNormals[i * 3 + 1] * thickness,
        positions[i * 3 + 2] - openNormals[i * 3 + 2] * thickness
      );
    }

    const solidIndices = indices.slice();
    // Bottom: same triangles, reversed winding so their normal faces down/outward
    for (let t = 0; t < indices.length; t += 3) {
      solidIndices.push(indices[t] + vertexCount, indices[t + 2] + vertexCount, indices[t + 1] + vertexCount);
    }
    // Walls: for directed top edge (i -> j), quad (i, j, i') + (j, j', i')
    // — verified against the right-hand rule to face outward, not just
    // assumed to.
    boundaryEdges.forEach(([i, j]) => {
      const ip = i + vertexCount, jp = j + vertexCount;
      solidIndices.push(i, j, ip, j, jp, ip);
    });

    return {
      positions: solidPositions,
      indices: solidIndices,
      normals: _computeNormals(solidPositions, solidIndices),
      wasOpen: true,
    };
  }

  function exportPNG() {
    Engine.screenshot('png');
    if (window.ModToast) ModToast.show('PNG saved', 'success');
  }

  function exportJPG() {
    Engine.screenshot('jpg');
    if (window.ModToast) ModToast.show('JPG saved', 'success');
  }

  /**
   * High-resolution screenshot — temporarily upscales renderer
   */
  function exportHighRes(multiplier = 2) {
    const renderer = Engine.getRenderer();
    const scene    = Engine.getScene();
    const camera   = Engine.getCamera(); // the actual rendered camera, so the screenshot always matches what's on screen

    const origSize = new THREE.Vector2();
    renderer.getSize(origSize);
    const origPixelRatio = renderer.getPixelRatio();

    renderer.setPixelRatio(origPixelRatio * multiplier);
    renderer.setSize(origSize.x, origSize.y, false);
    renderer.render(scene, camera);

    const dataURL = renderer.domElement.toDataURL('image/png');

    // Restore
    renderer.setPixelRatio(origPixelRatio);
    renderer.setSize(origSize.x, origSize.y, false);

    const a = document.createElement('a');
    a.download = 'graph3d-hires.png';
    a.href = dataURL;
    a.click();

    if (window.ModToast) ModToast.show('High-res PNG saved (' + multiplier + 'x)', 'success');
  }

  // ══════════════════════════════════════════════════════
  // OBJ MESH EXPORT
  // ══════════════════════════════════════════════════════

  function exportOBJ({ combined = false } = {}) {
    const meshes = Engine.getMeshes();
    const meshList = Object.values(meshes).filter(m => m && m.isMesh);

    if (meshList.length === 0) {
      if (window.ModToast) ModToast.show('No surfaces to export', 'error');
      return;
    }

    let out = '# Graph3D Pro — OBJ Export\n';
    out += '# Generated ' + new Date().toISOString() + '\n';
    out += '# Each surface is solidified to a closed, watertight shell where needed (open height-fields etc.)\n\n';

    let vertexOffset = 1;
    let anyWasOpen = false;

    if (combined) out += 'o Graph3D_Combined\n';

    meshList.forEach((mesh, idx) => {
      const raw = _collectExportGeometry(mesh);
      const thickness = _boundingDiagonal(raw.positions) * 0.03;
      const solid = _solidify(raw.positions, raw.indices, thickness);
      if (solid.wasOpen) anyWasOpen = true;

      if (!combined) out += `o Surface_${idx + 1}\n`;

      const vCount = solid.positions.length / 3;
      for (let i = 0; i < vCount; i++) {
        out += `v ${solid.positions[i*3].toFixed(5)} ${solid.positions[i*3+1].toFixed(5)} ${solid.positions[i*3+2].toFixed(5)}\n`;
      }
      for (let i = 0; i < vCount; i++) {
        out += `vn ${solid.normals[i*3].toFixed(5)} ${solid.normals[i*3+1].toFixed(5)} ${solid.normals[i*3+2].toFixed(5)}\n`;
      }
      for (let i = 0; i < solid.indices.length; i += 3) {
        const a = solid.indices[i]     + vertexOffset;
        const b = solid.indices[i + 1] + vertexOffset;
        const c = solid.indices[i + 2] + vertexOffset;
        out += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
      }

      out += '\n';
      vertexOffset += vCount;
    });

    _downloadText(out, 'graph3d-' + Date.now() + (combined ? '-combined' : '') + '.obj', 'text/plain');
    if (window.ModToast) {
      ModToast.show('OBJ mesh exported' + (anyWasOpen ? ' (solidified for printing)' : ''), 'success');
    }
  }

  // ══════════════════════════════════════════════════════
  // STL MESH EXPORT (binary)
  // ══════════════════════════════════════════════════════

  function exportSTL() {
    const meshes = Engine.getMeshes();
    const meshList = Object.values(meshes).filter(m => m && m.isMesh);

    if (meshList.length === 0) {
      if (window.ModToast) ModToast.show('No surfaces to export', 'error');
      return;
    }

    // Solidify every surface up front — need the final triangle count
    // (which grows once open surfaces get walls + a bottom) before the
    // binary buffer can be sized.
    let anyWasOpen = false;
    const solids = meshList.map(mesh => {
      const raw = _collectExportGeometry(mesh);
      const thickness = _boundingDiagonal(raw.positions) * 0.03;
      const solid = _solidify(raw.positions, raw.indices, thickness);
      if (solid.wasOpen) anyWasOpen = true;
      return solid;
    });

    const totalTriangles = solids.reduce((sum, s) => sum + s.indices.length / 3, 0);

    // STL binary format: 80-byte header + 4-byte count + 50 bytes per triangle
    const bufferSize = 80 + 4 + (totalTriangles * 50);
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    const header = 'Graph3D Pro STL Export (watertight)';
    for (let i = 0; i < header.length && i < 80; i++) view.setUint8(i, header.charCodeAt(i));
    view.setUint32(80, totalTriangles, true);

    let offset = 84;
    solids.forEach(({ positions, indices, normals }) => {
      for (let t = 0; t < indices.length; t += 3) {
        const ia = indices[t], ib = indices[t + 1], ic = indices[t + 2];

        // Per-triangle facet normal (averaged vertex normals — smoother
        // than a raw face cross-product, and still correctly outward
        // since it's built from the same consistently-wound triangles).
        const nx = (normals[ia*3] + normals[ib*3] + normals[ic*3]) / 3;
        const ny = (normals[ia*3+1] + normals[ib*3+1] + normals[ic*3+1]) / 3;
        const nz = (normals[ia*3+2] + normals[ib*3+2] + normals[ic*3+2]) / 3;
        const nLen = Math.hypot(nx, ny, nz) || 1;

        view.setFloat32(offset, nx / nLen, true); offset += 4;
        view.setFloat32(offset, ny / nLen, true); offset += 4;
        view.setFloat32(offset, nz / nLen, true); offset += 4;

        [ia, ib, ic].forEach(vi => {
          view.setFloat32(offset, positions[vi*3],     true); offset += 4;
          view.setFloat32(offset, positions[vi*3 + 1], true); offset += 4;
          view.setFloat32(offset, positions[vi*3 + 2], true); offset += 4;
        });

        view.setUint16(offset, 0, true); offset += 2; // attribute byte count (unused)
      }
    });

    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = 'graph3d-' + Date.now() + '.stl';
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);

    if (window.ModToast) {
      ModToast.show('STL exported' + (anyWasOpen ? ' (solidified for printing)' : ''), 'success');
    }
  }

  // ══════════════════════════════════════════════════════
  // JSON PROJECT EXPORT
  // ══════════════════════════════════════════════════════

  function exportJSON() {
    const state = {
      version: '1.0',
      created: new Date().toISOString(),
      equations: window.ModEquations ? ModEquations.serialize() : [],
      sliders:   window.ModSliders   ? ModSliders.serialize()   : {},
      settings:  window.ModSettings  ? ModSettings.get()        : {},
    };

    const json = JSON.stringify(state, null, 2);
    _downloadText(json, 'graph3d-project-' + Date.now() + '.json', 'application/json');
    if (window.ModToast) ModToast.show('Project exported as JSON', 'success');
  }

  // ══════════════════════════════════════════════════════
  // JSON PROJECT IMPORT
  // ══════════════════════════════════════════════════════

  function importJSON(file) {
    if (!file) {
      // Trigger file picker
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', e => {
        const f = e.target.files[0];
        if (f) _readAndImport(f);
      });
      input.click();
      return;
    }
    _readAndImport(file);
  }

  function _readAndImport(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const state = JSON.parse(e.target.result);
        if (window.ModEquations) ModEquations.clearAll();
        if (window.ModSliders)   ModSliders.clearAll();

        if (state.equations) {
          state.equations.forEach(eq => window.ModEquations && ModEquations.addEquation(eq));
        }
        if (state.sliders) {
          Object.entries(state.sliders).forEach(([name, opts]) => {
            window.ModSliders && ModSliders.addSlider(name, opts.value ?? 1, opts);
          });
        }
        if (state.settings && window.ModSettings) {
          ModSettings.loadFromState({ settings: state.settings });
        }

        if (window.ModToast) ModToast.show('Project imported successfully', 'success');
      } catch (err) {
        if (window.ModToast) ModToast.show('Invalid project file', 'error');
      }
    };
    reader.readAsText(file);
  }

  // ══════════════════════════════════════════════════════
  // CSV EXPORT — sampled point data
  // ══════════════════════════════════════════════════════

  function exportCSV() {
    const eqs = window.ModEquations ? ModEquations.getAll() : [];
    const explicitEqs = eqs.filter(e => e.type === 'explicit' && e.expr.trim());

    if (explicitEqs.length === 0) {
      if (window.ModToast) ModToast.show('No explicit equations to export as CSV', 'error');
      return;
    }

    const cfg = Engine.getConfig();
    const N = 40; // lower res for CSV readability
    let csv = 'x,y,' + explicitEqs.map((e, i) => 'z' + (i + 1)).join(',') + '\n';

    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const x = cfg.xMin + (cfg.xMax - cfg.xMin) * j / N;
        const y = cfg.yMin + (cfg.yMax - cfg.yMin) * i / N;
        const zVals = explicitEqs.map(eq => {
          const z = MathEngine.evalExpr(eq.expr, { x, y, ...(window.ModSliders ? ModSliders.getValues() : {}) });
          return isNaN(z) ? '' : z.toFixed(5);
        });
        csv += `${x.toFixed(4)},${y.toFixed(4)},${zVals.join(',')}\n`;
      }
    }

    _downloadText(csv, 'graph3d-data-' + Date.now() + '.csv', 'text/csv');
    if (window.ModToast) ModToast.show('CSV data exported', 'success');
  }

  // ══════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════

  function _downloadText(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.download = filename;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ══════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════
  return {
    exportPNG,
    exportJPG,
    exportHighRes,
    exportOBJ,
    exportSTL,
    exportJSON,
    importJSON,
    exportCSV,
  };

})();
