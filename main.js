const MAX_PRESTIGE = 9;
const MAX_BOON = 10;
const MAX_BREATHE = 20;
const BASE_WAVES = 10;
const WAVES_PER_DIFF = 20;
const BREATH_REDUCTION = 5;
const BOON_BONUS = 0.1;
const STORAGE_KEY = 'ieh_optimizer_data';

function generateTables()
{
    let columnHtml = '';
    for (let i = 0; i <= MAX_PRESTIGE; i++) {
        columnHtml += `
            <tr>
                <td>${i + 1}</td>
                <td><span id="waves_${i}">0</span></td>
                <td><input class="form-control clears" type="number" step="500" value="0" id="clears_${i}" name="clears[${i}]" /></td>
                <td><span id="points_${i}">0</span></td>
                <td><span id="effective_${i}">0</span></td>
                <td><span id="effective_time_${i}">0</span></td>
            </tr>
        `;
    }
    document.getElementById('tables').innerHTML = `
        <div id="area-progression">
            <h2>Area progression</h2>
            <table class="table table-hover table-sm">
                <thead>
                    <th>Diff</th>
                    <th>Waves</th>
                    <th title="Efficiency does not calculate intermediate values, meaning 500 clears and 999 will have the same efficiency">
                        Current clears
                    </th>
                    <th>Current points</th>
                    <th title="Efficiency is calculated by the number of clears you need to complete to earn one point. The more, the better. This column doesn't take into account the number of waves, so it's not entirely representative, but rather for informational purposes. It's better to look at the Effective Time column. Formula: (1 / neededClearsForOnePoint * 1000000) * (1 + boonLevel * BOON_BONUS)">
                        Efficiency
                    </th>
                    <th title="Time-based efficiency (as far as possible) is calculated based on the normal efficiency value and the number of waves. More is better. This is the column you should use to determine which difficulty is most profitable to farm at the moment. Formula: effective / (1 + timePerWave * (waves - BASE_WAVES))">
                        Efficiency time
                    </th>
                </thead>
                <tbody class="table-group-divider">
                    ${columnHtml}
                </tbody>
                <tfoot class="table-group-divider">
                    <tr>
                        <td></td>
                        <td></td>
                        <td><span id="total_clears">0</span></td>
                        <td><span id="total_points">0</span></td>
                        <td title="Average"><span id="avg_effective">0</span></td>
                        <td title="Average"><span id="avg_effective_time">0</span></td>
                    </tr>
                    <tr>
                        <td colspan="6" title="Displays the most effective diff by the Effective Time column">
                            Recommended diff: <span id="recommended_diff"></span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="6" title="Compares the effect of upgrades (by the Effective Time column) and divides it by the cost">
                            Recommended upgrade: <span id="recommended_upgrade"></span>
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
        <div id="sub-tables">
            <div>
                <h2>Prestige cost</h2>
                ${generateSubTable('prestige_cost', prestigeCost, MAX_PRESTIGE)}
            </div>
            <div>
                <h2>Breathe cost</h2>
                ${generateSubTable('breathe_cost', breatheCost, MAX_BREATHE)}
            </div>
            <div>
                <h2>Mission cost</h2>
                ${generateSubTable('mission_cost', missionCost, 3)}
            </div>
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

function recalculate()
{
    let state = {
        currentClears: 0,
        effective: 0,
        effectiveTime: 0,
        effectivePoints: 0,
        timePerWave: 0,
        needPoints: 0,
        waves: 0,
        prestigeLevel: 0,
        breatheLevel: 0,
        boonLevel: 0,
        points: 0,
        totalPoints: 0,
        totalEffective: 0,
        totalEffectiveTime: 0,
        totalClears: 0,
        totalAreas: 0,
        effectiveDiff: {
            openedValue: 0,
            openedIndex: null,
            closedValue: 0,
            closedIndex: null
        }
    };

    state.prestigeLevel = parseInt(document.getElementById(`prestige_level`).value);
    state.breatheLevel = parseInt(document.getElementById(`breathe_level`).value);
    state.boonLevel = parseInt(document.getElementById(`boon_level`).value);
    state.timePerWave = parseFloat(document.getElementById(`time_per_wave`).value);
    state.effectivePoints = parseInt(document.getElementById(`effective_points`).value);
    state.needPoints = parseInt(document.getElementById(`need_points`).value);

    function calcState(prevState, i) {
        const currentClears = parseInt(document.getElementById(`clears_${i}`).value) || 0;

        const points = getPointsByClear(currentClears);
        const waves = getWavesToDiff(i, prevState.breatheLevel);

        const effective = (1 / clearsToNextPoint(currentClears, prevState.effectivePoints) * 1000000) * (1 + prevState.boonLevel * BOON_BONUS);
        const effectiveTime = effective / (1 + prevState.timePerWave * (waves - BASE_WAVES));

        let newEffectiveDiff = { ...prevState.effectiveDiff };

        if (prevState.prestigeLevel >= i && effectiveTime > newEffectiveDiff.openedValue) {
            newEffectiveDiff.openedValue = effectiveTime;
            newEffectiveDiff.openedIndex = i;
        }
        if (effectiveTime > newEffectiveDiff.closedValue) {
            newEffectiveDiff.closedValue = effectiveTime;
            newEffectiveDiff.closedIndex = i;
        }

        const isIncluded = document.getElementById('include_not_prestiged').checked || (prevState.prestigeLevel >= i);

        return {
            ...prevState,
            currentClears,
            points,
            waves,
            effective,
            effectiveTime,
            effectiveDiff: newEffectiveDiff,
            //Sum values
            totalPoints: prevState.totalPoints + points,
            totalClears: prevState.totalClears + currentClears,
            totalEffective: isIncluded ? prevState.totalEffective + effective : prevState.totalEffective,
            totalEffectiveTime: isIncluded ? prevState.totalEffectiveTime + effectiveTime : prevState.totalEffectiveTime,
            totalAreas: isIncluded ? prevState.totalAreas + 1 : prevState.totalAreas
        };
    }

    for (let i = 0; i <= MAX_PRESTIGE; i++) {
        state = calcState(state, i);

        document.getElementById(`effective_${i}`).innerText = getSmartValue(state.effective);
        document.getElementById(`effective_time_${i}`).innerText = getSmartValue(state.effectiveTime);
        document.getElementById(`points_${i}`).innerText = state.points;
        document.getElementById(`waves_${i}`).innerText = state.waves;
    }
    document.getElementById(`total_clears`).innerText = state.totalClears;
    document.getElementById(`total_points`).innerText = state.totalPoints;
    document.getElementById(`avg_effective`).innerText = getSmartValue(state.totalEffective / state.totalAreas);
    document.getElementById(`avg_effective_time`).innerText = getSmartValue(state.totalEffectiveTime / state.totalAreas);

    document.getElementById(`prestige_level_points`).innerText = `Next: ${prestigeCost(state.prestigeLevel)}`;
    document.getElementById(`breathe_level_points`).innerText = `Next: ${breatheCost(state.breatheLevel)}`;
    document.getElementById(`boon_level_points`).innerText = `Next: ${boonCost(state.boonLevel)}`;

    document.getElementById(`left_points`).innerText = state.needPoints - state.totalPoints;
    document.getElementById(`current_points`).innerText = state.totalPoints
        - prestigeCost(state.prestigeLevel, true)
        - breatheCost(state.breatheLevel, true)
        - boonCost(state.boonLevel, true);

    const closedDiffText = state.effectiveDiff.closedIndex !== null
        && state.effectiveDiff.closedValue > state.effectiveDiff.openedValue ?
            `, but maybe it is better to open and farm diff ${state.effectiveDiff.closedIndex + 1}, it is ${getSmartValue(state.effectiveDiff.closedValue / state.effectiveDiff.openedValue)} times more effective` : ''
    document.getElementById(`recommended_diff`).innerText = `${state.effectiveDiff.openedIndex + 1}${closedDiffText}`;

    let breatheEff = 0;
    let boonEff = 0;
    if (state.breatheLevel < MAX_BREATHE) {
        breatheEff = checkUpgradeEff('breatheLevel') / breatheCost(state.breatheLevel);
    }
    if (state.boonLevel < MAX_BOON) {
        boonEff = checkUpgradeEff('boonLevel') / boonCost(state.boonLevel);
    }
    if (breatheEff > boonEff) {
        document.getElementById(`recommended_upgrade`).innerText =
            `Breathe - ${getSmartValue(breatheEff / boonEff)} times more effective than boon`;
    } else if (boonEff > breatheEff) {
        document.getElementById(`recommended_upgrade`).innerText =
            `Boon - ${getSmartValue(boonEff / breatheEff)} times more effective than breathe`;
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
        cloneState[name] += 1;
        for (let i = 0; i <= MAX_PRESTIGE; i++) {
            cloneState = calcState(cloneState, i);
        }
        return cloneState.totalEffectiveTime;
    }
}

const prestigeCost = (level, isTotal = false) => {
    return isTotal
        ? Math.pow(2, level) - 1
        : Math.pow(2, level);
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

function getWavesToDiff(diff, breatheLevel)
{
    return Math.max(BASE_WAVES + diff * WAVES_PER_DIFF - breatheLevel * BREATH_REDUCTION, BASE_WAVES);
}

function getPointsByClear(totalClear)
{
    return Math.floor((-1 + Math.sqrt(1 + (8 * totalClear) / 500)) / 2);
}

function clearsToNextPoint(totalClear, pointsForward = 1) {
    const currentLevel = getPointsByClear(totalClear);
    const targetLevel = currentLevel + pointsForward;
    const startClears = 250 * currentLevel * (currentLevel + 1);
    const endClears = 250 * targetLevel * (targetLevel + 1);

    return endClears - startClears;
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
    const inputs = document.querySelectorAll(`.${className}`);

    inputs.forEach(input => {
        data[input.id] = input.value;
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
                element.value = data[id];
            }
        });
    } catch (e) {
        console.error("Error read localStorage", e);
    }
}

inputEvents = ['clears', 'prestige_level', 'breathe_level', 'boon_level', 'time_per_wave', 'effective_points', 'include_not_prestiged', 'need_points'];

document.addEventListener('DOMContentLoaded', function() {
    generateTables();
    loadAllInputs();
    loadAllInputs();
    recalculate();

    document.querySelector('#ieh-optimize-area').addEventListener('input', (event) => {
        const isTargetInput = inputEvents.some(className => event.target.classList.contains(className));

        if (isTargetInput) {
            recalculate();
            saveAllInputs(inputEvents);
        }
    });
});