import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { AlertTriangle, Clock, Package, ShoppingCart, CalendarClock, CheckCircle } from 'lucide-react';

const ReorderIntelligence = ({ prediction }) => {
  const [currentStock, setCurrentStock] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const avgDailyDemand = prediction?.average_daily || 0;

  const calc = useMemo(() => {
    const stock = parseFloat(currentStock), lead = parseFloat(leadTime);
    if (!stock || !lead || stock <= 0 || lead <= 0 || avgDailyDemand <= 0) return null;
    const daysOut = Math.floor(stock / avgDailyDemand);
    const reorderDate = new Date();
    reorderDate.setDate(reorderDate.getDate() + Math.max(0, daysOut - lead));
    const orderQty = Math.max(0, Math.ceil(avgDailyDemand * 30 - stock));
    let status, color, bg;
    if (daysOut < 7) { status = 'CRITICAL'; color = 'text-red-700 dark:text-red-300'; bg = 'bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-800'; }
    else if (daysOut < 14) { status = 'WARNING'; color = 'text-yellow-700 dark:text-yellow-300'; bg = 'bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-800'; }
    else { status = 'HEALTHY'; color = 'text-green-700 dark:text-green-300'; bg = 'bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-800'; }
    return { daysOut, reorderDate, orderQty, status, color, bg };
  }, [currentStock, leadTime, avgDailyDemand]);

  return (
    <Card className="shadow-2xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
        <CardTitle className="flex items-center justify-between text-slate-900 dark:text-white">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            <span>Reorder Intelligence</span>
          </div>
          {calc && (
            <Badge className={`${calc.bg} ${calc.color}`}>
              {calc.status === 'CRITICAL' && <AlertTriangle className="h-3 w-3 mr-1" />}
              {calc.status === 'HEALTHY' && <CheckCircle className="h-3 w-3 mr-1" />}
              {calc.status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300 font-medium flex items-center space-x-2">
              <Package className="h-4 w-4 text-orange-500" /><span>Current Stock (units)</span>
            </Label>
            <Input type="number" min="0" value={currentStock} onChange={e => setCurrentStock(e.target.value)} placeholder="e.g., 500" className="h-12 bg-white dark:bg-slate-800" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300 font-medium flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-500" /><span>Lead Time (days)</span>
            </Label>
            <Input type="number" min="1" value={leadTime} onChange={e => setLeadTime(e.target.value)} placeholder="e.g., 7" className="h-12 bg-white dark:bg-slate-800" />
          </div>
        </div>
        {calc ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`rounded-xl p-4 border ${calc.bg} text-center`}>
              <div className={`text-3xl font-bold ${calc.color}`}>{calc.daysOut}</div>
              <p className="text-sm font-medium mt-1 text-slate-600 dark:text-slate-400">Days Until Stockout</p>
            </div>
            <div className="rounded-xl p-4 border bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 text-center">
              <div className="text-lg font-bold text-blue-700 dark:text-blue-300 flex items-center justify-center">
                <CalendarClock className="h-5 w-5 mr-2" />
                {calc.reorderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <p className="text-sm font-medium mt-1 text-slate-600 dark:text-slate-400">Reorder By Date</p>
            </div>
            <div className="rounded-xl p-4 border bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 text-center">
              <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">{calc.orderQty.toLocaleString()}</div>
              <p className="text-sm font-medium mt-1 text-slate-600 dark:text-slate-400">Suggested Order Qty</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 dark:text-slate-400">
            <Package className="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p>Enter current stock and lead time to see reorder recommendations</p>
            <p className="text-xs mt-1">Based on avg daily demand: {avgDailyDemand.toFixed(1)} units/day</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReorderIntelligence;
