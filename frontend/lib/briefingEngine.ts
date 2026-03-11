/**
 * AI Briefing Engine — generates context-aware briefing text
 * based on time of day, weather, solar data, and task state
 */

import type { TimeOfDay } from '@/hooks/useChronos';

export interface BriefingInput {
    userName: string;
    timeOfDay: TimeOfDay;
    hour: number;
    temperature: number;
    humidity: number;
    weatherDesc: string;
    cloudCover: number;
    windSpeed: number;
    solarEfficiency: number;
    energyToday: number;
    waterSaved: number;
    tasksTotal: number;
    tasksDone: number;
    sunrise: string;
    sunset: string;
    location: string;
}

export function generateBriefing(input: BriefingInput): { title: string; text: string; badge: string } {
    const {
        userName, timeOfDay, hour, temperature, humidity, weatherDesc,
        cloudCover, windSpeed, solarEfficiency, energyToday, waterSaved,
        tasksTotal, tasksDone, sunrise, sunset, location
    } = input;

    const tasksPending = tasksTotal - tasksDone;
    const firstName = userName?.split(' ')[0] || 'Sagar';
    const isRainy = weatherDesc.toLowerCase().includes('rain');
    const isCloudy = cloudCover > 60;

    switch (timeOfDay) {
        case 'morning':
            return {
                title: 'AI Morning Briefing',
                badge: 'LIVE',
                text: buildMorningBriefing(firstName, temperature, humidity, weatherDesc, cloudCover, solarEfficiency, tasksPending, sunrise, location),
            };
        case 'afternoon':
            return {
                title: 'AI Afternoon Update',
                badge: 'PEAK HOURS',
                text: buildAfternoonBriefing(firstName, temperature, solarEfficiency, energyToday, waterSaved, cloudCover, tasksPending, tasksDone),
            };
        case 'evening':
            return {
                title: 'AI Evening Report',
                badge: 'WIND DOWN',
                text: buildEveningBriefing(firstName, energyToday, waterSaved, tasksDone, tasksPending, sunset, solarEfficiency),
            };
        case 'night':
            return {
                title: 'AI Daily Summary',
                badge: 'END OF DAY',
                text: buildNightSummary(firstName, energyToday, waterSaved, tasksDone, tasksTotal, temperature),
            };
    }
}

function buildMorningBriefing(
    name: string, temp: number, humidity: number, desc: string,
    clouds: number, efficiency: number, pending: number, sunrise: string, location: string
): string {
    const rainWarning = desc.toLowerCase().includes('rain')
        ? 'Rain expected — delay any spraying until dry conditions return.'
        : 'No rain expected.';

    const solarOutlook = clouds > 60
        ? `Cloud cover at ${clouds}% may reduce panel output. Focus on crop tasks during overcast hours.`
        : `Clear skies with ${clouds}% cloud cover — panels projecting ${efficiency}% efficiency at peak.`;

    return `Good morning, ${name}. Today's forecast for ${location}: ${desc}, ${temp}°C with ${humidity}% humidity — ${rainWarning} ${solarOutlook} Sunrise was at ${sunrise}. You have ${pending} task${pending !== 1 ? 's' : ''} queued for today. Start with irrigation during the cool hours for optimal water absorption.`;
}

function buildAfternoonBriefing(
    name: string, temp: number, efficiency: number, energy: number,
    water: number, clouds: number, pending: number, done: number
): string {
    const peakStatus = efficiency > 80
        ? `Panels at peak ${efficiency}% efficiency — maximum power generation in progress.`
        : `Panel efficiency at ${efficiency}% due to ${clouds}% cloud cover. Bio-cooling is compensating with +3°C reduction.`;

    const taskStatus = done > 0
        ? `You've completed ${done} task${done !== 1 ? 's' : ''} so far.`
        : 'No tasks completed yet — consider prioritizing irrigation.';

    return `${name}, it's peak solar hours. ${peakStatus} Generated ${energy} kWh so far today, saving ${water}L of water through panel shade. ${taskStatus} ${pending > 0 ? `${pending} task${pending !== 1 ? 's' : ''} remaining — the harvest window may close by 4 PM.` : 'All tasks completed ✓'}`;
}

function buildEveningBriefing(
    name: string, energy: number, water: number, done: number,
    pending: number, sunset: string, efficiency: number
): string {
    const performanceSummary = energy > 15
        ? `Strong solar day — ${energy} kWh generated, exceeding the daily average.`
        : `Moderate solar day — ${energy} kWh generated. Panels will wind down as sun sets at ${sunset}.`;

    return `${name}, the sun is setting. ${performanceSummary} Panel shade saved ${water}L of water today. Tasks: ${done} completed, ${pending} remaining. ${pending > 0 ? 'Consider completing remaining tasks before dark.' : 'All tasks done — excellent work today ✓'} Evening is ideal for reviewing market prices and planning tomorrow's schedule.`;
}

function buildNightSummary(
    name: string, energy: number, water: number,
    done: number, total: number, temp: number
): string {
    const taskRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const carbonCredits = Math.round(energy * 0.034 * 100) / 100; // ~0.034 credits per kWh

    const verdict = taskRate >= 80
        ? 'Excellent productivity today.'
        : taskRate >= 50
            ? 'Good progress today. Plan to catch up on missed tasks tomorrow morning.'
            : 'Several tasks were missed. Consider setting earlier reminders.';

    return `${name}, here's your daily summary. Solar generation: ${energy} kWh (${energy > 15 ? 'above' : 'near'} daily target). Water savings: ${water}L from panel shade. Tasks: ${done}/${total} completed (${taskRate}%). Carbon credits earned today: ~${carbonCredits}. ${verdict} Panels are offline — current temperature: ${temp}°C. Rest well, dawn brings new opportunities.`;
}

// ─── Dynamic Task Generator ────────────────────────────────

export interface FarmTask {
    id: string;
    time: string;
    task: string;
    category: 'irrigation' | 'protection' | 'monitoring' | 'harvest' | 'solar' | 'market';
    done: boolean;
    priority: 'high' | 'medium' | 'low';
}

/**
 * Generate context-aware tasks based on current time, weather, and solar conditions
 */
export function generateTasks(
    hour: number,
    temperature: number,
    humidity: number,
    cloudCover: number,
    isRainy: boolean,
): FarmTask[] {
    const tasks: FarmTask[] = [];

    // Pre-dawn / early morning tasks
    if (hour < 12) {
        tasks.push({
            id: 'irrigation-morning',
            time: '6:00 AM',
            task: isRainy
                ? 'Skip irrigation — rain providing natural watering'
                : `Irrigate tomato section (reduced ${temperature > 30 ? '15' : '25'}% — panel shade saving)`,
            category: 'irrigation',
            done: hour > 7,  // auto-done if past time
            priority: isRainy ? 'low' : 'high',
        });
    }

    tasks.push({
        id: 'protection-spray',
        time: '8:00 AM',
        task: humidity > 75
            ? 'Apply fungicide — high humidity risk for leaf blight'
            : 'Apply neem oil spray — preventive for leaf curl',
        category: 'protection',
        done: false,
        priority: humidity > 75 ? 'high' : 'medium',
    });

    tasks.push({
        id: 'monitoring-growth',
        time: '10:00 AM',
        task: `Check growth stage of turmeric (Day ${Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 15).getTime()) / 86400000)})`,
        category: 'monitoring',
        done: false,
        priority: 'medium',
    });

    if (cloudCover < 50) {
        tasks.push({
            id: 'solar-check',
            time: '11:00 AM',
            task: 'Inspect panel surfaces — clean any dust accumulation for peak noon efficiency',
            category: 'solar',
            done: false,
            priority: 'medium',
        });
    }

    tasks.push({
        id: 'harvest-window',
        time: '2:00 PM',
        task: temperature > 35
            ? 'Delay spinach harvest — heat stress risk. Reschedule to 4:30 PM'
            : 'Harvest spinach batch — optimal market window before 3 PM Mandi closing',
        category: 'harvest',
        done: false,
        priority: temperature > 35 ? 'low' : 'high',
    });

    if (hour >= 15) {
        tasks.push({
            id: 'market-review',
            time: '4:00 PM',
            task: 'Review Mandi closing prices — decide on tomorrow\'s sell/hold strategy',
            category: 'market',
            done: false,
            priority: 'medium',
        });
    }

    return tasks;
}
