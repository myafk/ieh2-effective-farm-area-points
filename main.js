const BASE_WAVES = 10;
const D_BASE_WAVES = 100;
const WAVES_PER_DIFF = 20;
const BREATH_REDUCTION = 5;
const BOON_BONUS = 0.1;
const STORAGE_KEY = 'ieh_optimizer_data';

function generateTables(type)
{
    const prefix = getPrefixByType(type);
    let columnHtml = '';
    let diff = getCurrentDiff(type);
    const name = type === 'dungeon' ? 'Dungeon' : 'Area';
    for (let i = 0; i <= diff; i++) {
        columnHtml += `
            <tr>
                <td>${i + 1}</td>
                <td><span id="${prefix}waves_${i}">0</span></td>
                <td><input class="form-control clears" type="number" step="500" value="0" id="${prefix}clears_${i}" /></td>
                <td><span id="${prefix}points_${i}">0</span></td>
                <td><span id="${prefix}effective_time_${i}">0</span> (<span id="${prefix}effective_${i}">0</span>)</td>
                <td><input class="form-control clear_time" type="number" step="0.01" value="" id="${prefix}clear_time_${i}" /></td>
            </tr>
        `;
    }
    let otherTables = '';
    if (type === 'area') {
        otherTables = `
            <div>
                <h2>Breathe cost</h2>
                ${generateSubTable('breathe_cost', breatheCost, 20)}
            </div>
            <div>
                <h2>Mission cost</h2>
                ${generateSubTable('mission_cost', missionCost, 3)}
            </div>
        `;
    }

    document.getElementById(`${prefix}tables`).innerHTML = `
        <div id="${type}-progression">
            <h2>${name} progression</h2>
            <table class="table table-hover table-sm" id="table-${type}-progression">
                <thead>
                    <th class="diff-th">
                        <div class="input-group">
                            <label for="${prefix}diff" class="input-group-text">Diff</label>
                            <input type="number" id="${prefix}diff" class="form-control diff" value="${diff + 1}" />
                        </div>
                    </th>
                    <th>Waves</th>
                    <th title="Efficiency does not calculate intermediate values, meaning 500 clears and 999 will have the same efficiency. Input accept format like: '1e8', '5.5e10'">
                        <div class="input-group">
                            <label for="${prefix}all_clears" class="input-group-text">Current clears</label>
                            <input type="number" id="${prefix}all_clears" class="form-control all_clears" value="" />
                        </div>
                    </th>
                    <th>Current points</th>
                    <th title="Efficiency (in brackets) is calculated by the number of clears you need to complete to earn one point. The more, the better. This column doesn't take into account the number of waves, so it's not entirely representative, but rather for informational purposes. It's better to look at the Effective Time column. Formula: (1 / neededClearsForOnePoint * 1000000) * (1 + boonLevel * BOON_BONUS). Time-based efficiency (as far as possible) is calculated based on the normal efficiency value and the number of waves. More is better. This is the column you should use to determine which difficulty is most profitable to farm at the moment. Formula: effective / (1 + timePerWave * (waves - BASE_WAVES))">
                        Efficiency time
                    </th>
                    <th class="clear-time-th" title="Entering a clear time here will result in a more accurate efficiency measurement, but this isn't necessary. If you don't enter one, it will be calculated using the time per wave value.">
                        <div class="input-group">
                            <label for="${prefix}all_clear_time" class="input-group-text">Clear time</label>
                            <input type="number" id="${prefix}all_clear_time" class="form-control all_clear_time" value="" />
                        </div>
                    </th>
                </thead>
                <tbody class="table-group-divider">
                    ${columnHtml}
                </tbody>
                <tfoot class="table-group-divider">
                    <tr>
                        <td></td>
                        <td></td>
                        <td><span id="${prefix}total_clears">0</span></td>
                        <td><span id="${prefix}total_points">0</span></td>
                        <td title="Average"><span id="${prefix}avg_effective_time">0</span> (<span id="${prefix}avg_effective">0</span>)</td>
                        <td title="Average"><span id="${prefix}avg_clear_time">0</span></td>
                    </tr>
                    <tr>
                        <td colspan="6" title="Displays the most effective diff by the Effective Time column">
                            Recommended diff: <span id="${prefix}recommended_diff"></span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="6" title="Compares the effect of upgrades (by the Effective Time column) and divides it by the cost">
                            Recommended upgrade: <span id="${prefix}recommended_upgrade"></span>
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
        <div id="${prefix}sub-tables">
            <div>
                <h2>Prestige cost</h2>
                ${generateSubTable('prestige_cost', prestigeCost, getCurrentDiff(type))}
            </div>
            ${otherTables}
        </div>
    `;
}

function generateSubTable(name, costFn, maxLevel)
{
    let columnHtml = '';
    let totalCost = 0;
    for (let i = 0; i <= maxLevel - 1; i++) {
        const cost = costFn(i);
        totalCost += cost;
        columnHtml += `
            <tr>
                <td>${i + 1}</td>
                <td>${cost}</td>
                <td>${totalCost}</td>
            </tr>
        `;
    }
    return `
        <table class="table table-sm" id="${name}">
            <thead>
                <th>Level</th>
                <th>Cost</th>
                <th>Total</th>
            </thead>
            <tbody class="table-group-divider">
                ${columnHtml}
            </tbody>
        </table>
    `;
}

function recalculate(type)
{
    let state = {
        currentClears: 0,
        effective: 0,
        pureEffective: 0,
        effectiveTime: 0,
        effectivePoints: 0,
        timePerWave: 0,
        needPoints: 0,
        waves: 0,
        prestigeLevel: 0,
        breatheLevel: 0,
        boonLevel: 0,
        points: 0,
        ftBoss: 0,
        totalPoints: 0,
        totalEffective: 0,
        totalPureEffective: 0,
        totalEffectiveTime: 0,
        totalClears: 0,
        totalAreas: 0,
        totalClearTime: 0,
        effectiveDiff: {
            openedValue: 0,
            openedIndex: null,
            closedValue: 0,
            closedIndex: null
        }
    };
    const prefix = getPrefixByType(type);

    state.prestigeLevel = parseInt(document.getElementById(`${prefix}prestige_level`).value);
    if (type === 'area') {
        state.breatheLevel = parseInt(document.getElementById(`${prefix}breathe_level`).value);
        state.boonLevel = parseInt(document.getElementById(`${prefix}boon_level`).value);
    }
    state.timePerWave = parseFloat(document.getElementById(`${prefix}time_per_wave`).value);
    state.effectivePoints = parseInt(document.getElementById(`${prefix}effective_points`).value);
    state.needPoints = parseInt(document.getElementById(`${prefix}need_points`).value);
    state.ftBoss = document.getElementById(`${prefix}ft_boss`).checked

    function calcState(prevState, i) {
        const currentClears = parseFloat(document.getElementById(`${prefix}clears_${i}`).value) || 0;

        const points = getPointsByClear(type, currentClears);
        const waves = getWavesToDiff(type, i, prevState.breatheLevel);

        const pureEffective = (1 / clearsToNextPoint(type, currentClears, prevState.effectivePoints) * 100000000) * (1 + prevState.boonLevel * BOON_BONUS);
        let effective = pureEffective;
        if (prevState.ftBoss) {
            effective = prevState.totalPureEffective + effective;
        }

        let clearTimeKey = null;
        let clearTime = null;
        for (let k = i; k >= 0; k--) {
            if (parseFloat(document.getElementById(`${prefix}clear_time_${k}`).value)) {
                clearTimeKey = k;
                clearTime = parseFloat(document.getElementById(`${prefix}clear_time_${k}`).value);
                break;
            }
        }
        let effectiveTime;
        if (clearTimeKey !== null) {
            const waveLast = getWavesToDiff(type, clearTimeKey, prevState.breatheLevel);
            effectiveTime = effective * (1 / (clearTime + prevState.timePerWave * (waves - waveLast)));
        } else {
            const clearTimeCalc = prevState.timePerWave * waves;
            const factor = clearTimeCalc ? clearTimeCalc : 0.01;
            effectiveTime = effective / (factor / 0.01);
        }

        let newEffectiveDiff = { ...prevState.effectiveDiff };

        if (prevState.prestigeLevel >= i && effectiveTime > newEffectiveDiff.openedValue) {
            newEffectiveDiff.openedValue = effectiveTime;
            newEffectiveDiff.openedIndex = i;
        }
        if (effectiveTime > newEffectiveDiff.closedValue) {
            newEffectiveDiff.closedValue = effectiveTime;
            newEffectiveDiff.closedIndex = i;
        }

        const isIncluded = document.getElementById(`${prefix}include_not_prestiged`).checked || (prevState.prestigeLevel >= i);

        return {
            ...prevState,
            currentClears,
            points,
            waves,
            effective,
            pureEffective,
            effectiveTime,
            effectiveDiff: newEffectiveDiff,
            //Sum values
            totalPoints: prevState.totalPoints + points,
            totalClears: prevState.totalClears + currentClears,
            totalEffective: isIncluded ? prevState.totalEffective + effective : prevState.totalEffective,
            totalPureEffective: prevState.totalPureEffective + pureEffective,
            totalEffectiveTime: isIncluded ? prevState.totalEffectiveTime + effectiveTime : prevState.totalEffectiveTime,
            totalAreas: isIncluded ? prevState.totalAreas + 1 : prevState.totalAreas,
            totalClearTime: isIncluded ? prevState.totalClearTime + clearTime : prevState.totalClearTime,
        };
    }

    for (let i = 0; i <= getCurrentDiff(type); i++) {
        state = calcState(state, i);
        document.getElementById(`${prefix}effective_${i}`).innerText = getSmartValue(state.effective);
        document.getElementById(`${prefix}effective_time_${i}`).innerText = getSmartValue(state.effectiveTime);
        document.getElementById(`${prefix}points_${i}`).innerText = state.points;
        document.getElementById(`${prefix}waves_${i}`).innerText = state.waves;
    }
    document.getElementById(`${prefix}total_clears`).innerText = state.totalClears;
    document.getElementById(`${prefix}total_points`).innerText = state.totalPoints;
    document.getElementById(`${prefix}avg_effective`).innerText = getSmartValue(state.totalEffective / state.totalAreas);
    document.getElementById(`${prefix}avg_effective_time`).innerText = getSmartValue(state.totalEffectiveTime / state.totalAreas);
    document.getElementById(`${prefix}avg_clear_time`).innerText = getSmartValue(state.totalClearTime / state.totalAreas);

    document.getElementById(`${prefix}prestige_level_points`).innerText = `Next: ${prestigeCost(state.prestigeLevel)}`;
    if (type === 'area') {
        document.getElementById(`${prefix}breathe_level_points`).innerText = `Next: ${breatheCost(state.breatheLevel)}`;
        document.getElementById(`${prefix}boon_level_points`).innerText = `Next: ${boonCost(state.boonLevel)}`;
    }
    document.getElementById(`${prefix}left_points`).innerText = state.needPoints - state.totalPoints;
    document.getElementById(`${prefix}current_points`).innerText = state.totalPoints
        - prestigeCost(state.prestigeLevel, true)
        - breatheCost(state.breatheLevel, true)
        - boonCost(state.boonLevel, true);

    const closedDiffText = state.effectiveDiff.closedIndex !== null
        && state.effectiveDiff.closedValue > state.effectiveDiff.openedValue ?
            `, but maybe it is better to open and farm diff ${state.effectiveDiff.closedIndex + 1}, it is ${getSmartValue(state.effectiveDiff.closedValue / state.effectiveDiff.openedValue)} times more effective` : ''
    document.getElementById(`${prefix}recommended_diff`).innerText = `${state.effectiveDiff.openedIndex + 1}${closedDiffText}`;
    highlightRow(`table-${type}-progression`, state.effectiveDiff.openedIndex, 'table-success');
    highlightRow(`table-${type}-progression`, state.effectiveDiff.closedValue > state.effectiveDiff.openedValue ? state.effectiveDiff.closedIndex : -1, 'table-secondary')

    if (type === 'area') {
        let breatheEff;
        let boonEff;
        const bEff = checkUpgradeEff('breatheLevel');
        //Some time breathe can be useless (if wave maxed)
        if (bEff > state.totalEffectiveTime) {
            breatheEff = checkUpgradeEff('breatheLevel') / breatheCost(state.breatheLevel);
        } else {
            breatheEff = null;
        }
        boonEff = checkUpgradeEff('boonLevel') / boonCost(state.boonLevel);
        if (breatheEff > boonEff) {
            document.getElementById(`recommended_upgrade`).innerText =
                `Breathe - ${getSmartValue(breatheEff / boonEff)} times more effective than boon`;
        } else if (boonEff > breatheEff) {
            document.getElementById(`recommended_upgrade`).innerText =
                `Boon - ${getSmartValue(boonEff / breatheEff)} times more effective than breathe`;
        }
    }

    //Effective upgrade - clone state, replace some values, calculate state again
    function checkUpgradeEff(name)
    {
        let cloneState = structuredClone(state);
        cloneState.totalPoints = 0;
        cloneState.totalAreas = 0;
        cloneState.totalEffectiveTime = 0;
        cloneState.totalClears = 0;
        cloneState.totalEffective = 0;
        cloneState.totalClearTime = 0;
        cloneState[name] += 1;
        for (let i = 0; i <= getCurrentDiff(type); i++) {
            cloneState = calcState(cloneState, i);
        }
        return cloneState.totalEffectiveTime;
    }
}

const prestigeCost = (level, isTotal = false) => {
    const threshold = 8;
    const getSingleCost = (l) => {
        if (l <= threshold) {
            return Math.pow(2, l);
        } else {
            return Math.pow(2, threshold) * Math.pow(3, l - threshold);
        }
    };

    if (!isTotal) {
        return getSingleCost(level);
    }

    if (level <= threshold) {
        return Math.pow(2, level + 1) - 2;
    } else {
        const sumToThreshold = Math.pow(2, threshold + 1) - 2;

        const a1 = getSingleCost(threshold + 1);
        const n = level - threshold;
        const q = 3;

        const sumAfterThreshold = a1 * (Math.pow(q, n) - 1) / (q - 1);

        return sumToThreshold + sumAfterThreshold;
    }
};

const breatheCost = (level, isTotal = false) => {
    return isTotal
        ? level * (1 + level)
        : 2 + level * 2;
};

const boonCost = (level, isTotal = false) => {
    return isTotal
        ? 2.5 * level * (1 + level)
        : 5 + level * 5;
};

const missionCost = (level, isTotal = false) => {
    return isTotal
        ? 1.5 * level * (1 + level)
        : 3 + level * 3;
};

function getWavesToDiff(type, diff, breatheLevel)
{
    if (type === 'dungeon') {
        return D_BASE_WAVES + (100 * (diff * (diff + 1)) / 2);
    }
    return Math.max(BASE_WAVES + diff * WAVES_PER_DIFF - breatheLevel * BREATH_REDUCTION, BASE_WAVES);
}

function getPointsByClear(type, totalClear)
{
    return Math.floor((-1 + Math.sqrt(1 + (8 * totalClear) / 500)) / 2);
}

function clearsToNextPoint(type, totalClear, pointsForward = 1) {
    const currentLevel = getPointsByClear(type, totalClear);
    const targetLevel = currentLevel + pointsForward;
    const startClears = 250 * currentLevel * (currentLevel + 1);
    const endClears = 250 * targetLevel * (targetLevel + 1);

    return endClears - startClears;
}

function highlightRow(tableId, index, className) {
    const table = document.getElementById(tableId);
    const rows = table.querySelectorAll('tbody tr');

    const currentRow = table.querySelector(`tr.${className}`);
    if (currentRow) {
        currentRow.classList.remove(className);
    }

    if (rows[index]) {
        rows[index].classList.add(className);
    }
}

function getSmartValue(rawValue) {
    let precision;

    if (rawValue >= 10) {
        precision = 2;
    } else if (rawValue >= 1) {
        precision = 3;
    } else {
        precision = 4;
    }

    return Number(rawValue.toFixed(precision)).toString();
}

function saveAllInputs(className) {
    const data = {};
    className.forEach(name => {
        const inputs = document.querySelectorAll(`.${name}`);

        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                data[input.id] = input.checked;
            } else {
                data[input.id] = input.value;
            }
        });
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadAllInputs() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (!savedData) return;

    try {
        const data = JSON.parse(savedData);
        Object.keys(data).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = data[id];
                } else {
                    element.value = data[id];
                }
            }
        });
    } catch (e) {
        console.error("Error read localStorage", e);
    }
}

function getCurrentDiff(type) {
    const prefix = getPrefixByType(type);
    return parseInt(getStorageValue(`${prefix}diff`, 10)) - 1;
}

function getStorageValue(key, defaultValue = null) {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (!savedData) return;

    const data = JSON.parse(savedData);

    return data[key] ?? defaultValue;
}

function getPrefixByType(type) {
    return type === 'dungeon' ? 'd_' : '';
}

inputEvents = [
    'clears', 'prestige_level', 'breathe_level', 'boon_level', 'time_per_wave',
    'effective_points', 'include_not_prestiged', 'need_points', 'diff', 'clear_time',
    'ft_boss'
];

document.addEventListener('DOMContentLoaded', function() {
    generateTables('area');
    generateTables('dungeon');
    loadAllInputs();
    recalculate('area');
    recalculate('dungeon');

    document.querySelector('#ieh-optimize-area').addEventListener('input', (event) => {
        bindEvents('area', event);
    });
    document.querySelector('#ieh-optimize-dungeon').addEventListener('input', (event) => {
        bindEvents('dungeon', event);
    });

});

function bindEvents(type, event) {
    const isTargetInput = inputEvents.some(className => event.target.classList.contains(className));

    if (event.target.classList.contains('all_clears')) {
        document.querySelectorAll(`.clears`).forEach(input => {
            input.value = event.target.value;
        });
        saveAllInputs(inputEvents);
        recalculate(type);
    }
    if (event.target.classList.contains('all_clear_time')) {
        document.querySelectorAll(`.clear_time`).forEach(input => {
            input.value = event.target.value;
        });
        saveAllInputs(inputEvents);
        recalculate(type);
    }

    if (isTargetInput) {
        saveAllInputs(inputEvents);
        if (event.target.classList.contains('diff')) {
            generateTables(type);
        }
        recalculate(type);
    }
}