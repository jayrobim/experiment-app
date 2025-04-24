<template>
  <div class="container">
    <canvas ref="canvas" :width="canvasWidth" :height="canvasHeight"></canvas>
    <div class="control-panel">
      <div style="display: inline-block; margin-bottom: 10px;">
        <label>模拟模式：</label>
        <label><input type="radio" v-model="simulationMode" value="single"> 单性状</label>
        <label><input type="radio" v-model="simulationMode" value="double"> 双性状</label>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <div>
          <label for="offspringCount" style="margin-right: 3px;">后代数量：</label>
          <input type="number" id="offspringCount" v-model.number="totalSimulationSteps" min="10" max="500"
                 style="width: 50px;">
        </div>
        <div>
          <label for="animationSpeed" style="margin-right: 3px;">模拟速度：</label>
          <input type="range" id="animationSpeed" v-model.number="animationSpeed" min="1" max="1999"
                 style="width: 150px;">
        </div>
      </div>

      <div style="margin-top: 15px;">
        <button @click="extractOnce" :disabled="isSimulationRunning || animationState !== 'idle'">模拟一次</button>
        <button @click="startSimulation" :disabled="isSimulationRunning">开始模拟</button>
        <button @click="pauseSimulation" :disabled="!isSimulationRunning">暂停</button>
        <button @click="resetSimulation">重置</button>
      </div>
      <div class="progress-container">
        <div class="progress-bar" :style="{ width: progressPercent + '%' }">{{ progressPercent }}%</div>
      </div>
    </div>

    <div class="result-container">
      <div id="resultsTable">
        <table v-if="simulationMode === 'single'">
          <thead>
          <tr>
            <th>表型</th>
            <th>观察值</th>
            <th>观察比例</th>
            <th>理论预期值</th>
            <th>理论比例</th>
          </tr>
          </thead>
          <tbody>
          <tr>
            <td>显性(A_)</td>
            <td>{{ result.A_ }}</td>
            <td>{{ (currentSimulationStep > 0 ? (result.A_ / currentSimulationStep * 100).toFixed(1) : 0) }}%</td>
            <td>{{ Math.round(currentSimulationStep * 0.75) }}</td>
            <td>75%</td>
          </tr>
          <tr>
            <td>隐性(aa)</td>
            <td>{{ result.aa }}</td>
            <td>{{ (currentSimulationStep > 0 ? (result.aa / currentSimulationStep * 100).toFixed(1) : 0) }}%</td>
            <td>{{ Math.round(currentSimulationStep * 0.25) }}</td>
            <td>25%</td>
          </tr>
          </tbody>
        </table>

        <table v-else>
          <thead>
          <tr>
            <th>表型</th>
            <th>观察值</th>
            <th>观察比例</th>
            <th>理论预期值</th>
            <th>理论比例</th>
          </tr>
          </thead>
          <tbody>
          <tr>
            <td>双显(A_B_)</td>
            <td>{{ result.A_B_ }}</td>
            <td>{{ (currentSimulationStep > 0 ? (result.A_B_ / currentSimulationStep * 100).toFixed(1) : 0) }}%</td>
            <td>{{ Math.round(currentSimulationStep * 9 / 16) }}</td>
            <td>56.25%</td>
          </tr>
          <tr>
            <td>A显b隐(A_bb)</td>
            <td>{{ result.A_bb }}</td>
            <td>{{ (currentSimulationStep > 0 ? (result.A_bb / currentSimulationStep * 100).toFixed(1) : 0) }}%</td>
            <td>{{ Math.round(currentSimulationStep * 3 / 16) }}</td>
            <td>18.75%</td>
          </tr>
          <tr>
            <td>a隐B显(aaB_)</td>
            <td>{{ result.aaB_ }}</td>
            <td>{{ (currentSimulationStep > 0 ? (result.aaB_ / currentSimulationStep * 100).toFixed(1) : 0) }}%</td>
            <td>{{ Math.round(currentSimulationStep * 3 / 16) }}</td>
            <td>18.75%</td>
          </tr>
          <tr>
            <td>双隐(aabb)</td>
            <td>{{ result.aabb }}</td>
            <td>{{ (currentSimulationStep > 0 ? (result.aabb / currentSimulationStep * 100).toFixed(1) : 0) }}%</td>
            <td>{{ Math.round(currentSimulationStep * 1 / 16) }}</td>
            <td>6.25%</td>
          </tr>
          </tbody>
        </table>
      </div>
      <div class="chart-container" ref="chartCanvas"></div>
    </div>
  </div>
</template>

<script>
import {computed, onMounted, ref, watch} from 'vue';
import * as echarts from 'echarts';

export default {
  name: 'GeneticSimulation',
  setup() {
    // Canvas相关
    const canvas = ref(null);
    const chartCanvas = ref(null);
    const ctx = ref(null);

    let chartInstance = null; // 存储 ECharts 实例

    // 画布尺寸
    const canvasWidth = ref(400);
    const canvasHeight = ref(200);

    // 实验参数
    const ballCount = ref(5);
    const totalSimulationSteps = ref(100);
    const currentSimulationStep = ref(0);
    const animationSpeed = ref(5);
    const simulationMode = ref('single'); // 'single' or 'double'
    const animationDuration = computed(() => 2000 - animationSpeed.value);

    // 状态
    const animationState = ref('idle'); // 'idle', 'extracting', 'combining', 'result'
    const animationStartTime = ref(0);
    const isSimulationRunning = ref(false);
    const simulationTimeout = ref(null);

    // 结果数据
    const result = ref({
      'A_': 0,
      'aa': 0,
      'A_B_': 0,
      'A_bb': 0,
      'aaB_': 0,
      'aabb': 0
    });

    // 进度条计算
    const progressPercent = computed(() => {
      return totalSimulationSteps.value > 0
          ? Math.round((currentSimulationStep.value / totalSimulationSteps.value) * 100)
          : 0;
    });

    // 矩形区域定义
    const rectangles = ref([
      { // 左侧矩形
        x: 100,
        y: 100,
        width: 200,
        height: 250,
        color: '#E3F2FD',
        borderColor: '#1976D2',
        balls: [],
        extractedBall: null
      },
      { // 右侧矩形
        x: 400,
        y: 100,
        width: 200,
        height: 250,
        color: '#E8F5E9',
        borderColor: '#388E3C',
        balls: [],
        extractedBall: null
      }
    ]);

    // 合成球
    const combinedBall = ref(null);
    const combinedType = ref('');

    // 球类
    class Ball {
      constructor(rect, type) {
        this.rect = rect;
        this.type = type;
        this.radius = 15;
        this.originalRadius = 15;
        this.resetPosition();
        this.dx = (Math.random() - 0.5) * 3;
        this.dy = (Math.random() - 0.5) * 3;
        this.color = this.getColor(type);
        this.isExtracted = false;
        this.animationStartX = 0;
        this.animationStartY = 0;
        this.animationTargetX = 0;
        this.animationTargetY = 0;
      }

      getColor(type) {
        if (simulationMode.value === 'single') {
          return type === 'A' ? '#FF5252' : '#448AFF';
        } else {
          // 双性状颜色方案
          if (type === 'AB') return '#FF5252';      // 红色 - 双显性
          if (type === 'Ab') return '#FFA000';      // 橙色 - A显性b隐性
          if (type === 'aB') return '#7E57C2';      // 紫色 - a隐性B显性
          if (type === 'ab') return '#448AFF';      // 蓝色 - 双隐性
        }
      }

      resetPosition() {
        this.x = this.rect.x + this.radius + Math.random() * (this.rect.width - 2 * this.radius);
        this.y = this.rect.y + this.radius + Math.random() * (this.rect.height - 2 * this.radius);
      }

      update(currentTime) {
        if (animationState.value === 'idle' && !this.isExtracted) {
          // 正常运动模式
          if (this.x + this.radius > this.rect.x + this.rect.width || this.x - this.radius < this.rect.x) {
            this.dx = -this.dx;
          }
          if (this.y + this.radius > this.rect.y + this.rect.height || this.y - this.radius < this.rect.y) {
            this.dy = -this.dy;
          }

          this.x += this.dx;
          this.y += this.dy;
        } else if (this.isExtracted) {
          // 抽取动画
          if (animationState.value === 'extracting') {
            const elapsed = currentTime - animationStartTime.value;
            const progress = Math.min(elapsed / animationDuration.value, 1);

            this.x = this.animationStartX + (this.animationTargetX - this.animationStartX) * progress;
            this.y = this.animationStartY + (this.animationTargetY - this.animationStartY) * progress;
            this.radius = this.originalRadius + Math.sin(currentTime / 100) * 2;

            if (progress >= 1) {
              animationState.value = 'combining';
              animationStartTime.value = currentTime;
              startCombiningAnimation();
            }
          }
        }

        if (!this.isExtracted) {
          this.radius = this.originalRadius;
        }
      }

      draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();

        ctx.fillStyle = 'white';
        ctx.font = `${this.radius}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type, this.x, this.y);

        if (this.isExtracted) {
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.closePath();
        }
      }
    }

    // 初始化球
    const initBalls = (count) => {
      rectangles.value.forEach(rect => {
        rect.balls = [];
        rect.extractedBall = null;
      });
      combinedBall.value = null;
      animationState.value = 'idle';

      rectangles.value.forEach(rect => {
        if (simulationMode.value === 'single') {
          // 单性状模式
          for (let i = 0; i < count; i++) {
            rect.balls.push(new Ball(rect, 'A'));
          }
          for (let i = 0; i < count; i++) {
            rect.balls.push(new Ball(rect, 'a'));
          }
        } else {
          // 双性状模式
          const types = ['AB', 'Ab', 'aB', 'ab'];
          types.forEach(type => {
            for (let i = 0; i < count; i++) {
              rect.balls.push(new Ball(rect, type));
            }
          });
        }
        rect.balls.sort(() => Math.random() - 0.5);
      });
    };

    // 绘制矩形
    const drawRectangles = () => {
      rectangles.value.forEach(rect => {
        ctx.value.fillStyle = rect.color;
        ctx.value.fillRect(rect.x, rect.y, rect.width, rect.height);

        ctx.value.strokeStyle = rect.borderColor;
        ctx.value.lineWidth = 1;
        ctx.value.strokeRect(rect.x, rect.y, rect.width, rect.height);

        ctx.value.fillStyle = rect.borderColor;
        ctx.value.font = '14px Arial';
        ctx.value.textAlign = 'center';
        ctx.value.fillText(
            rect === rectangles.value[0] ? '雄配子' : '雌配子',
            rect.x + rect.width / 2,
            rect.y - 10
        );
      });
    };

    // 绘制合成球
    const drawCombinedBall = (currentTime) => {
      if (!combinedBall.value) return;

      if (animationState.value === 'combining') {
        const elapsed = currentTime - animationStartTime.value;
        const progress = Math.min(elapsed / animationDuration.value, 1);

        combinedBall.value.x =
            combinedBall.value.animationStartX +
            (combinedBall.value.animationTargetX - combinedBall.value.animationStartX) * progress;
        combinedBall.value.y =
            combinedBall.value.animationStartY +
            (combinedBall.value.animationTargetY - combinedBall.value.animationStartY) * progress;
        combinedBall.value.radius = 5 + (combinedBall.value.originalRadius - 5) * progress;
        combinedBall.value.radius += Math.sin(currentTime / 100) * 2;

        if (progress >= 1) {
          animationState.value = 'result';
          animationStartTime.value = currentTime;
          showResult();
        }
      }

      ctx.value.beginPath();
      ctx.value.arc(
          combinedBall.value.x,
          combinedBall.value.y,
          combinedBall.value.radius,
          0,
          Math.PI * 2
      );

      // 根据组合类型设置颜色
      if (simulationMode.value === 'single') {
        if (combinedType.value.includes('A')) {
          ctx.value.fillStyle = '#FF5252';
        } else {
          ctx.value.fillStyle = '#448AFF';
        }
      } else {
        // 双性状颜色方案
        if (combinedType.value.includes('A') && combinedType.value.includes('B')) {
          ctx.value.fillStyle = '#FF5252';      // 红色 - 双显性
        } else if (combinedType.value.includes('A') && combinedType.value.includes('bb')) {
          ctx.value.fillStyle = '#FFA000';      // 橙色 - A显性b隐性
        } else if (combinedType.value.includes('aa') && combinedType.value.includes('B')) {
          ctx.value.fillStyle = '#7E57C2';      // 紫色 - a隐性B显性
        } else {
          ctx.value.fillStyle = '#448AFF';      // 蓝色 - 双隐性
        }
      }

      ctx.value.fill();
      ctx.value.closePath();

      ctx.value.fillStyle = 'white';
      ctx.value.font = `${combinedBall.value.radius - 4}px Arial`;
      ctx.value.textAlign = 'center';
      ctx.value.textBaseline = 'middle';
      ctx.value.fillText(combinedType.value, combinedBall.value.x, combinedBall.value.y);

      ctx.value.beginPath();
      ctx.value.arc(
          combinedBall.value.x,
          combinedBall.value.y,
          combinedBall.value.radius + 8,
          0,
          Math.PI * 2
      );
      ctx.value.strokeStyle = 'rgba(255, 215, 0, 0.7)';
      ctx.value.lineWidth = 3;
      ctx.value.stroke();
      ctx.value.closePath();
    };

    // 开始抽取动画
    const startExtractingAnimation = () => {
      const leftRect = rectangles.value[0];
      const rightRect = rectangles.value[1];

      rectangles.value.forEach(rect => {
        if (rect.balls.length > 0) {
          const ballIndex = Math.floor(Math.random() * rect.balls.length);
          const ball = rect.balls[ballIndex];

          ball.animationStartX = ball.x;
          ball.animationStartY = ball.y;
          ball.animationTargetX = (leftRect.x + rightRect.x + rightRect.width) / 2;
          ball.animationTargetY = rect.y - 50 + ball.radius + 5;
          ball.isExtracted = true;
          rect.extractedBall = ball;
        }
      });

      if (leftRect.extractedBall && rightRect.extractedBall) {
        animationState.value = 'extracting';
        animationStartTime.value = performance.now();
      }
    };

    // 开始合成动画
    const startCombiningAnimation = () => {
      const leftBall = rectangles.value[0].extractedBall;
      const rightBall = rectangles.value[1].extractedBall;
      if (simulationMode.value === 'single') {
        combinedType.value = leftBall.type + rightBall.type;
      } else {
        // 双性状组合
        const leftType = leftBall.type;
        const rightType = rightBall.type;

        // 组合基因型 (例如 AB + aB → AaBB)
        combinedType.value = leftType[0] + rightType[0] + leftType[1] + rightType[1];
      }
      combinedBall.value = {
        x: leftBall.x,
        y: leftBall.y,
        radius: 5,
        originalRadius: 20,
        animationStartX: leftBall.x,
        animationStartY: leftBall.y,
        animationTargetX: canvasWidth.value / 2,
        animationTargetY: 50
      };

      rectangles.value[0].balls = rectangles.value[0].balls.filter(b => b !== leftBall);
      rectangles.value[1].balls = rectangles.value[1].balls.filter(b => b !== rightBall);
      rectangles.value[0].extractedBall = null;
      rectangles.value[1].extractedBall = null;
    };

    const initChart = () => {
      if (!chartCanvas.value) return;

      // 如果已存在实例，先销毁
      if (chartInstance) {
        chartInstance.dispose();
      }

      // 初始化图表
      chartInstance = echarts.init(chartCanvas.value);
      updateChart(); // 首次渲染
    };

    const updateChart = () => {
      if (!chartInstance) return;

      let option;
      if (simulationMode.value === 'single') {
        option = {
          title: {
            text: '单性状分离比 (预期比例 3:1)',
            left: 'center',
            textStyle: {
              fontSize: 14,
              fontWeight: 'bold',
              color: '#333',
            },
          },
          tooltip: {
            trigger: 'axis',
            axisPointer: {
              type: 'shadow',
            },
          },
          xAxis: {
            type: 'category',
            data: ['显性性状', '隐性性状'],
          },
          yAxis: {
            type: 'value',
            name: '个体数量',
          },
          series: [
            {
              name: '观察值',
              type: 'bar',
              data: [result.value.A_, result.value.aa],
              itemStyle: {
                color: (params) => (params.dataIndex === 0 ? '#3498db' : '#e74c3c'),
              },
            },
          ],
        };
      } else {
        option = {
          title: {
            text: '双性状分离比 (预期比例 9:3:3:1)',
            left: 'center',
            textStyle: {
              fontSize: 14,
              fontWeight: 'bold',
              color: '#333',
            },
          },
          tooltip: {
            trigger: 'axis',
            axisPointer: {
              type: 'shadow',
            },
          },
          xAxis: {
            type: 'category',
            data: ['双显', 'A显b隐', 'a隐B显', '双隐'],
            axisLabel: {
              interval: 0,
              fontSize: 10, // 字体大小
              margin: 8 // 标签与轴的距离
            }
          },
          yAxis: {
            type: 'value',
            name: '个体数量',
          },
          series: [
            {
              name: '观察值',
              type: 'bar',
              data: [result.value.A_B_, result.value.A_bb, result.value.aaB_, result.value.aabb],
              itemStyle: {
                color: (params) => {
                  const colors = ['#FF5252', '#FFA000', '#7E57C2', '#448AFF'];
                  return colors[params.dataIndex];
                },
              },
            },
          ],
        };
      }
      chartInstance.setOption(option);
    };

    // 显示结果
    const showResult = () => {
      if (simulationMode.value === 'single') {
        if (combinedType.value.includes('A')) {
          result.value.A_++;
        } else {
          result.value.aa++;
        }
      } else {
        if (combinedType.value.includes('A') && combinedType.value.includes('B')) {
          result.value.A_B_++;
        } else if (combinedType.value.includes('A') && combinedType.value.includes('bb')) {
          result.value.A_bb++;
        } else if (combinedType.value.includes('aa') && combinedType.value.includes('B')) {
          result.value.aaB_++;
        } else {
          result.value.aabb++;
        }
      }

      currentSimulationStep.value++;

      if (isSimulationRunning.value && currentSimulationStep.value < totalSimulationSteps.value) {
        simulationTimeout.value = setTimeout(() => {
          if (animationState.value === 'idle' || animationState.value === 'result') {
            initBalls(ballCount.value);
            startExtractingAnimation();
          }
        }, 30);
      } else if (currentSimulationStep.value >= totalSimulationSteps.value) {
        stopSimulation();
      } else {
        setTimeout(() => {
          animationState.value = 'idle';
          combinedBall.value = null;
          initBalls(ballCount.value);
        }, 30);
      }
    };

    // 模拟控制函数
    const extractOnce = () => {
      resetSimulation();
      startExtractingAnimation();
    };

    const startSimulation = () => {
      if (currentSimulationStep.value >= totalSimulationSteps.value) {
        resetSimulation();
      }

      isSimulationRunning.value = true;
      if (animationState.value === 'idle' || animationState.value === 'result') {
        startExtractingAnimation();
      }
    };

    const pauseSimulation = () => {
      isSimulationRunning.value = false;
      if (simulationTimeout.value) {
        clearTimeout(simulationTimeout.value);
        simulationTimeout.value = null;
      }
    };

    const stopSimulation = () => {
      isSimulationRunning.value = false;
      if (simulationTimeout.value) {
        clearTimeout(simulationTimeout.value);
        simulationTimeout.value = null;
      }
    };

    const resetSimulation = () => {
      stopSimulation();
      currentSimulationStep.value = 0;
      result.value = {
        'A_': 0,
        'aa': 0,
        'A_B_': 0,
        'A_bb': 0,
        'aaB_': 0,
        'aabb': 0
      };
      initBalls(ballCount.value);
    };

    // 动画循环
    const animate = (currentTime) => {
      ctx.value.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
      drawRectangles();

      rectangles.value.forEach(rect => {
        rect.balls.forEach(ball => {
          ball.update(currentTime);
          ball.draw(ctx.value);
        });

        if (rect.extractedBall) {
          rect.extractedBall.update(currentTime);
          rect.extractedBall.draw(ctx.value);
        }
      });

      if (combinedBall.value) {
        drawCombinedBall(currentTime);
      }

      requestAnimationFrame(animate);
    };

    // 响应式调整画布大小
    const setupResponsiveRectangles = () => {
      const containerWidth = canvas.value.parentElement.clientWidth;
      const containerHeight = containerWidth / 4 + 50;

      canvasWidth.value = containerWidth;
      canvasHeight.value = containerHeight;

      const rectWidth = containerWidth / 2 - 10;
      const rectHeight = containerHeight - 50; // 矩形高度比 Canvas 小 50px

      rectangles.value[0] = {
        x: 0,
        y: containerHeight - rectHeight - 1, // 矩形底部对齐 Canvas 底部
        width: rectWidth,
        height: rectHeight,
        color: '#E3F2FD',
        borderColor: '#1976D2',
        balls: [],
        extractedBall: null
      };

      rectangles.value[1] = {
        x: containerWidth - rectWidth,
        y: containerHeight - rectHeight - 1, // 矩形底部对齐 Canvas 底部
        width: rectWidth,
        height: rectHeight,
        color: '#E8F5E9',
        borderColor: '#388E3C',
        balls: [],
        extractedBall: null
      };

      initBalls(ballCount.value);
    };

    // 组件挂载时初始化
    onMounted(() => {
      ctx.value = canvas.value.getContext('2d');
      setupResponsiveRectangles();
      animate();
      initChart();
    });

    // 监听模拟模式变化
    watch(simulationMode, () => {
      resetSimulation();
      updateChart();
    });

    watch(
        () => [result.value.A_, result.value.aa, result.value.A_B_, result.value.A_bb, result.value.aaB_, result.value.aabb],
        () => {
          updateChart();
        },
        {deep: true}
    );

    return {
      canvas,
      chartCanvas,
      canvasWidth,
      canvasHeight,
      ballCount,
      totalSimulationSteps,
      currentSimulationStep,
      animationSpeed,
      simulationMode,
      animationState,
      isSimulationRunning,
      result,
      progressPercent,
      extractOnce,
      startSimulation,
      pauseSimulation,
      resetSimulation
    };
  }
}
</script>

<style scoped>
.container {
  background-color: #f5f5f5;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 20px;
}

canvas {
  width: 100%;
  background-color: white;
  border-radius: 5px;
}

.control-panel {
  font-size: 12px;
  margin: 20px 0;
  background-color: #eaf2f8;
  border-radius: 5px;
  padding: 10px;
}

.result-container {
  font-size: 11px;
  margin: 10px 0;
  background-color: white;
  border-radius: 5px;
  padding: 10px;
}

button {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 10px;
  transition: background-color 0.3s;
}

button:hover {
  background-color: #2980b9;
}

button:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
}

th, td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: center;
}

th {
  background-color: #f2f2f2;
}

.progress-container {
  width: 100%;
  background-color: #ddd;
  border-radius: 5px;
  margin: 10px 0;
}

.progress-bar {
  height: 10px;
  background-color: #4CAF50;
  border-radius: 5px;
  width: 0;
  transition: width 0.3s;
  text-align: center;
  color: white;
  line-height: 10px;
  font-size: 10px;
}

.chart-container {
  margin-top: 20px;
  width: 100%;
  height: 220px;
}

label {
  margin-right: 10px;
  cursor: pointer;
}

input[type="radio"] {
  margin-right: 5px;
}
</style>