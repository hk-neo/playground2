@REQ_PLAYG-1972
Feature: SR-003 3D 볼륨 렌더링 (Ray Casting) - 외곽 벽 아티팩트
	#CBCT 외곽 벽면 백색 아티팩트 미발생 - ray-box intersection 기반 진입점 계산

	@TEST_PLAYG-2542 @REQ_PLAYG-2352 @TESTSET_PLAYG-2476 @AI
	Scenario: CBCT 외곽 벽 백색 아티팩트 미발생 검증
		Given DICOM 뷰어 시스템에 CBCT 의료 영상 시리즈가 로드되어 3D 볼륨 렌더링이 활성화된 상태이고
		When 사용자가 다양한 각도에서 3D 볼륨을 회전하고 확대하여 관찰하면
		Then CBCT 외곽 벽면에 백색 아티팩트가 발생하지 않고 정상적으로 렌더링된다
