# [打造个人户外运动主页](http://zhaohongxuan.github.io/workouts)

<img width="1484" alt="image" src="https://github.com/zhaohongxuan/workouts/assets/8613196/b9286fcd-f4c0-42c6-9561-9417096fec4c">

本项目基于 [running_page](https://github.com/yihong0618/running_page/blob/master/README-CN.md) , 添加了支持多种运动类型。部署可参考原项目操作步骤

## 新增特性

- 支持同步**Strava的跑步记录**到数字心动APP（获取上马积分，**通过注入设备信息到Garmin Connect中实现）**，设备信息通过在config.py中设置

## 同步数据

- 跑步数据同步请参考[running_page](https://github.com/yihong0618/running_page/blob/master/README-CN.md) 项目
- 骑行数据同步请参考[workouts_page](https://github.com/ben-29/workouts_page)项目

## 一些个性化选项

### 自定义运动颜色

- 修改骑行颜色: `src/utils/const.js` 里的 `RIDE_COLOR`

### 新增运动类型

- 修改 `scripts/config.py`, `TYPE_DICT` 增加类型映射关系, `MAPPING_TYPE` 里增加运动类型
- 修改 `src/utils/const.js`, 增加类型标题，并加入到 `RUN_TITLES`
- 修改 `src/utils/util.js` 里的 `colorFromType`, 增加 case 指定颜色; `titleForRun`  增加 case 指定类型标题

- 参考这个 [commit](https://github.com/ben-29/workouts_page/commit/bfb6e9da4f72bdbdec669c42bdd10062558039cd)
---

# 致谢
感谢@[yihong0618](https://github.com/yihong0618)和@[ben-29](https://github.com/ben-29)优秀的开源项目
- [workouts_page](https://github.com/ben-29/workouts_page)
- [running_page](https://github.com/yihong0618/running_page)
