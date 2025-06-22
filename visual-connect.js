class VisualConnect {
    constructor(container) {
        this.container = container;
        this.blockCounter = 0;
        this.connections = [];
        this.blockConfigs = {};
        this.selectedBlock = null;
        this.isDragging = false;
        this.dragOffset = {x:0,y:0};
        this.isConnecting = false;
        this.connectionStart = null;
        this.tempConnection = null;

        this.blockTemplates = {
            start: { color: '#27ae60', text: 'START', configurable: false, code: { js:'// Program Start', py:'# Program Start', pseudo:'BEGIN PROGRAM' } },
            process: { color: '#3498db', text: 'PROCESS', configurable: true, config: { operation: { label:'Operation', type:'text', default:'processStep()' } }, code: {
                js: c=>c.operation||'processStep();',
                py: c=>c.operation||'process_step()',
                pseudo: c=>`PROCESS: ${c.operation||'Execute operation'}`
            }},
            condition: { color: '#f39c12', text: 'IF/ELSE', configurable: true, config: { condition:{label:'Condition',type:'text',default:'condition'} }, code: {
                js: c=>`if (${c.condition||'condition'}) {\n  // True path\n} else {\n  // False path\n}`,
                py: c=>`if ${c.condition||'condition'}:\n  # True path\nelse:\n  # False path`,
                pseudo: c=>`IF ${c.condition||'condition'} THEN\n  true path\nELSE\n  false path\nENDIF`
            }},
            end: { color: '#e74c3c', text: 'END', configurable: false, code: { js:'// Program End', py:'# Program End', pseudo:'END PROGRAM' } },
            input: { color: '#9b59b6', text: 'INPUT', configurable: true, config: {
                prompt:{label:'Prompt',type:'text',default:'Enter value:'}, variable:{label:'Variable',type:'text',default:'input'}
            }, code: {
                js: c=>`const ${c.variable||'input'} = prompt("${c.prompt||'Enter value:'}");`,
                py: c=>`${c.variable||'input_value'} = input("${c.prompt||'Enter value:'}")`,
                pseudo: c=>`INPUT: ${c.prompt||'Get user input'} → ${c.variable||'input'}`
            }},
            output: { color: '#1abc9c', text: 'OUTPUT', configurable: true, config: {
                message:{label:'Message',type:'text',default:'result'}
            }, code: {
                js: c=>`console.log("${c.message||'Output:'}", ${c.message||'result'});`,
                py: c=>`print("${c.message||'Output:'}", ${c.message||'result'})`,
                pseudo: c=>`OUTPUT: Display ${c.message||'result'}`
            }},
            loop: { color: '#8e44ad', text: 'LOOP', configurable: true, config: {
                type:{label:'Loop Type',type:'select',options:['for','while'],default:'for'},
                condition:{label:'Condition/Range',type:'text',default:'i=0;i<10;i++'}
            }, code: {
                js: c=>c.type==='while'?
                    `while (${c.condition||'i<10'}) {\n  // Loop body\n}`:
                    `for (${c.condition||'i=0;i<10;i++'}) {\n  // Loop body\n}`,
                py: c=>c.type==='while'?
                    `while ${c.condition||'i<10'}:\n  # Loop body`:
                    `for i in ${c.condition||'range(10)'}:\n  # Loop body`,
                pseudo: c=>`LOOP ${c.type?.toUpperCase()||'FOR'} (${c.condition||'condition'}):\n  loop body\nEND LOOP`
            }},
            variable: { color: '#2ecc71', text: 'VARIABLE', configurable: true, config: {
                name:{label:'Var Name',type:'text',default:'myVar'},
                value:{label:'Initial Value',type:'text',default:'0'},
                type:{label:'Type',type:'select',options:['number','string'],default:'number'}
            }, code: {
                js: c=>`let ${c.name||'myVar'} = ${c.type==='string'?`"${c.value||''}"`:(c.value||'0')};`,
                py: c=>`${c.name||'my_var'} = ${c.type==='string'?`"${c.value||''}"`:(c.value||'0')}`,
                pseudo: c=>`DECLARE ${c.name||'myVar'} AS ${c.type?.toUpperCase()||'NUMBER'} = ${c.value||'0'}`
            }},
            function: { color: '#34495e', text: 'FUNCTION', configurable: true, config: {
                name:{label:'Func Name',type:'text',default:'myFunction'},
                parameters:{label:'Parameters',type:'text',default:'param1, param2'},
                body:{label:'Body',type:'textarea',default:'return param1 + param2;'}
            }, code: {
                js: c=>`function ${c.name||'myFunction'}(${c.parameters||''}) {\n  ${c.body||''}\n}`,
                py: c=>`def ${c.name||'my_function'}(${c.parameters||''}):\n  ${c.body||''}`,
                pseudo: c=>`FUNCTION ${c.name||'myFunction'} (${c.parameters||''}):\n  ${c.body||''}\nEND FUNCTION`
            }},
        };

        this._initUI();
    }

    // --- UI Setup ---
    _initUI() {
        this.container.innerHTML = `
        <div class="visual-connect-container">
            <div class="vc-toolbar">
                <h3>Blocks</h3>
                ${Object.entries(this.blockTemplates).map(([type,t])=>
                    `<div class="vc-block-template ${type}" data-type="${type}">${t.text}</div>`
                ).join('')}
            </div>
            <div class="vc-main">
                <div class="vc-workspace"></div>
                <div class="vc-controls">
                    <button class="clear">Clear</button>
                    <button class="code">Code</button>
                </div>
                <div class="vc-code-panel" style="display:none;">
                    <select class="vc-lang">
                        <option value="js">JavaScript</option>
                        <option value="py">Python</option>
                        <option value="pseudo">Pseudocode</option>
                    </select>
                    <pre class="vc-code"></pre>
                </div>
            </div>
        </div>
        <div class="vc-config-modal" style="display:none;">
            <div class="vc-config-box">
                <form></form>
                <div class="vc-config-buttons">
                    <button type="button" class="save">Save</button>
                    <button type="button" class="cancel">Cancel</button>
                </div>
            </div>
        </div>`;

        // Toolbar drag
        [...this.container.querySelectorAll('.vc-block-template')].forEach(el =>
            el.addEventListener('mousedown', e=>this._startTemplateDrag(e, el.dataset.type))
        );

        // Workspace events
        this.workspace = this.container.querySelector('.vc-workspace');
        this.workspace.addEventListener('mousedown', e=>this._selectBlock(null));
        // Controls
        this.container.querySelector('.clear').onclick = ()=>this.clearWorkspace();
        this.container.querySelector('.code').onclick = ()=>this._toggleCodePanel();
        this.container.querySelector('.vc-lang').onchange = ()=>this._updateCode();
        // Modal config events
        this._setupConfigModal();
    }

    // --- Block Creation ---
    _startTemplateDrag(e, type) {
        e.preventDefault();
        const onUp = ev => {
            document.removeEventListener('mouseup', onUp);
            const wsRect = this.workspace.getBoundingClientRect();
            const x = ev.clientX - wsRect.left - 45;
            const y = ev.clientY - wsRect.top - 20;
            if (x > 0 && y > 0 && x < wsRect.width && y < wsRect.height)
                this.addBlock(type, x, y);
        };
        document.addEventListener('mouseup', onUp);
    }

    addBlock(type, x, y) {
        const tpl = this.blockTemplates[type];
        const id = `block-${this.blockCounter++}`;
        const block = document.createElement('div');
        block.className = `vc-block ${type}`;
        block.style.background = tpl.color;
        block.setAttribute('data-id', id);
        block.style.left = `${x}px`; block.style.top = `${y}px`;
        block.innerHTML = tpl.text+
            `<div class="vc-conn-point input"></div>
            <div class="vc-conn-point output"></div>`+
            (tpl.configurable? `<button class="vc-config-btn" title="Configure">⚙</button>` : '')+
            `<button class="vc-del" title="Delete">&times;</button>`;
        // Drag events
        block.onmousedown = e=>this._startBlockDrag(e, block);
        // Select events
        block.onclick = e=>{e.stopPropagation();this._selectBlock(block)};
        // Delete
        block.querySelector('.vc-del').onclick = e=>{e.stopPropagation();this.deleteBlock(id)};
        // Configure
        if(block.querySelector('.vc-config-btn'))
            block.querySelector('.vc-config-btn').onclick = e=>{e.stopPropagation();this._openConfigModal(id,type)};
        // Connection points
        [...block.querySelectorAll('.vc-conn-point')].forEach(pt=>{
            pt.onclick = e=>{ e.stopPropagation(); this._startConnection(e, pt, block); };
        });
        this.workspace.appendChild(block);

        // Default config
        if(tpl.configurable) {
            this.blockConfigs[id] = {};
            Object.entries(tpl.config).forEach(([k,v])=>this.blockConfigs[id][k] = v.default);
        }
        this._updateCode();
    }

    deleteBlock(id) {
        const block = this.workspace.querySelector(`[data-id="${id}"]`);
        if(block) block.remove();
        this.connections = this.connections.filter(c => c.start!==id && c.end!==id);
        delete this.blockConfigs[id];
        this._updateCode();
    }

    clearWorkspace() {
        this.workspace.innerHTML = '';
        this.connections = [];
        this.blockConfigs = {};
        this.blockCounter = 0;
        this._updateCode();
    }

    // --- Block Dragging/Selecting ---
    _startBlockDrag(e, block) {
        if(e.target.classList.contains('vc-del') || e.target.classList.contains('vc-config-btn')) return;
        e.preventDefault();
        this.selectedBlock = block;
        block.classList.add('selected');
        const rect = block.getBoundingClientRect();
        const wsRect = this.workspace.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        const onMove = ev => {
            if(this.selectedBlock) {
                let x = ev.clientX - wsRect.left - this.dragOffset.x;
                let y = ev.clientY - wsRect.top - this.dragOffset.y;
                x = Math.max(0, Math.min(x, wsRect.width-90));
                y = Math.max(0, Math.min(y, wsRect.height-50));
                this.selectedBlock.style.left = `${x}px`;
                this.selectedBlock.style.top = `${y}px`;
            }
        };
        const onUp = () => {
            if(this.selectedBlock) {
                this.selectedBlock.classList.remove('selected');
                this.selectedBlock = null;
            }
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
    _selectBlock(block) {
        if(this.selectedBlock) this.selectedBlock.classList.remove('selected');
        this.selectedBlock = block;
        if(block) block.classList.add('selected');
    }

    // --- Connections (visual and logical) ---
    _startConnection(e, pt, block) {
        e.preventDefault();
        if(this.isConnecting) return;
        this.isConnecting = true;
        this.connectionStart = {pt, block};
        const onUp = ev => {
            const target = document.elementFromPoint(ev.clientX, ev.clientY);
            if(target && target.classList.contains('vc-conn-point') && target!==pt) {
                const startType = pt.classList.contains('input')?'input':'output';
                const endType = target.classList.contains('input')?'input':'output';
                if(startType!==endType) {
                    const from = startType==='output' ? block.getAttribute('data-id') : target.parentElement.getAttribute('data-id');
                    const to = startType==='output' ? target.parentElement.getAttribute('data-id') : block.getAttribute('data-id');
                    this.connections.push({start:from, end:to});
                    this._updateCode();
                }
            }
            this.isConnecting = false;
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mouseup', onUp);
    }

    // --- Config Modal ---
    _setupConfigModal() {
        this.modal = this.container.querySelector('.vc-config-modal');
        this.form = this.modal.querySelector('form');
        this.modal.querySelector('.save').onclick = ()=>this._saveConfig();
        this.modal.querySelector('.cancel').onclick = ()=>this._closeConfigModal();
    }
    _openConfigModal(id, type) {
        const tpl = this.blockTemplates[type];
        this.form.innerHTML = '';
        Object.entries(tpl.config).forEach(([key,field])=>{
            this.form.innerHTML +=
                `<label>${field.label}</label>`+
                (field.type==='select'?
                    `<select name="${key}">${field.options.map(opt=>
                        `<option value="${opt}" ${this.blockConfigs[id][key]===opt?'selected':''}>${opt}</option>`
                    ).join('')}</select>`:
                field.type==='textarea'?
                    `<textarea name="${key}">${this.blockConfigs[id][key]||field.default}</textarea>`:
                    `<input type="text" name="${key}" value="${this.blockConfigs[id][key]||field.default}" />`
                );
        });
        this._configBlockId = id;
        this.modal.style.display = 'flex';
    }
    _saveConfig() {
        const id = this._configBlockId;
        const fields = new FormData(this.form);
        for(let [k,v] of fields.entries())
            this.blockConfigs[id][k] = v;
        this._closeConfigModal();
        this._updateCode();
    }
    _closeConfigModal() { this.modal.style.display = 'none'; }

    // --- Code Generation ---
    _toggleCodePanel() {
        const panel = this.container.querySelector('.vc-code-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        this._updateCode();
    }
    _updateCode() {
        const panel = this.container.querySelector('.vc-code-panel');
        if(panel.style.display==='none') return;
        const lang = this.container.querySelector('.vc-lang').value;
        const blocks = [...this.workspace.querySelectorAll('.vc-block')];
        blocks.sort((a,b) => parseFloat(a.style.top)-parseFloat(b.style.top));
        let code = '';
        blocks.forEach(block=>{
            const id = block.getAttribute('data-id');
            const type = [...block.classList].find(c=>this.blockTemplates[c]);
            const tpl = this.blockTemplates[type];
            if(tpl.configurable)
                code += (tpl.code[lang]||tpl.code.js)(this.blockConfigs[id]) + '\n';
            else
                code += (tpl.code[lang]||tpl.code.js) + '\n';
        });
        this.container.querySelector('.vc-code').textContent = code;
    }
}

// Browser global
window.VisualConnect = VisualConnect;
